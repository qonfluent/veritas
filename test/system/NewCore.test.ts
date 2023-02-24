export type Var = number
export type StateStream<A> = { head: State<A>[], tail?: () => StateStream<A> }
export type State<A> = { subst: Subst<A>, fresh: Var }
export type Goal<A> = (state: State<A>) => StateStream<A>
export type Subst<A> = Map<Var, Term<A>>

export type Term<A>
	= { tag: 'TVar', var: Var }
	| { tag: 'TConst', value: A }
	| { tag: 'TSeq', value: Term<A>[] }

export function walk<A>(term: Term<A>, subst: Subst<A>): Term<A> {
	switch (term.tag) {
		case 'TVar': {
			const value = subst.get(term.var)
			if (value === undefined) return term
			return walk(value, subst)
		}
		default: return term
	}
}

export function unify<A>(equal: (lhs: A, rhs: A) => boolean, lhs: Term<A>, rhs: Term<A>, subst: Subst<A>): Subst<A> | undefined {
	const leftWalk = walk(lhs, subst)
	const rightWalk = walk(rhs, subst)

	if (leftWalk.tag === 'TVar' && rightWalk.tag === 'TVar' && leftWalk.var === rightWalk.var) {
		return subst
	}

	if (leftWalk.tag === 'TConst' && rightWalk.tag === 'TConst') {
		if (equal(leftWalk.value, rightWalk.value)) {
			return subst
		}

		return undefined
	}

	if (leftWalk.tag === 'TVar') {
		return new Map(subst).set(leftWalk.var, rightWalk)
	}

	if (rightWalk.tag === 'TVar') {
		return new Map(subst).set(rightWalk.var, leftWalk)
	}

	if (leftWalk.tag === 'TSeq' && rightWalk.tag === 'TSeq') {
		if (leftWalk.value.length !== rightWalk.value.length) return undefined

		let result: Subst<A> | undefined = subst
		for (let i = 0; i < leftWalk.value.length; i++) {
			result = unify(equal, leftWalk.value[i], rightWalk.value[i], result)
			if (result === undefined) return undefined
		}

		return result
	}

	return undefined
}

export function mergeStreams<A>(...streams: StateStream<A>[]): StateStream<A> {
	const heads = streams.flatMap((stream) => stream.head)
	const tails = streams.map((stream) => stream.tail).filter((tail): tail is (() => StateStream<A>) => tail !== undefined)
	return { head: heads, tail: () => mergeStreams(...tails.map((tail) => tail())) }
}

export function bind<A>(stream: StateStream<A>, goal: Goal<A>): StateStream<A> {
	const goals = stream.head.map((state) => goal(state)).concat(stream.tail ? [bind(stream.tail(), goal)] : [])
	return mergeStreams(...goals)
}

export function fresh<A>(f: (t: Term<A>) => Goal<A>): Goal<A> {
	return (state) => {
		return f({ tag: 'TVar', var: state.fresh })({ ...state, fresh: state.fresh + 1 })
	}
}

export function disj<A>(...goals: Goal<A>[]): Goal<A> {
	return (state) => {
		const streams = goals.map((goal) => goal(state))
		return mergeStreams(...streams)
	}
}

export function conj<A>(...goals: Goal<A>[]): Goal<A> {
	return (state) => {
		const stream = goals.reduce((stream: StateStream<A>, goal) => bind(stream, goal), { head: [state], tail: undefined })
		return stream
	}
}

export function equal<A>(eq: (lhs: A, rhs: A) => boolean, lhs: Term<A>, rhs: Term<A>): Goal<A> {
	return (state) => {
		const subst = unify(eq, lhs, rhs, state.subst)
		if (subst === undefined) return { head: [] }
		return { head: [{ ...state, subst }] }
	}
}

export function conde<A>(pairs: [Goal<A>, Goal<A>][]): Goal<A> {
	return disj<A>(...pairs.map(([lhs, rhs]) => conj<A>(lhs, rhs)))
}

describe('Basic unification', () => {
	describe('Constants', () => {
		it('unifies two constant terms', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TConst', value: 1 }, { tag: 'TConst', value: 1 }, new Map())
			expect(subst).toEqual(new Map())
		})
	})

	describe('Variables', () => {
		it('unifies two terms with a variable', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TVar', var: 0 }, { tag: 'TConst', value: 1 }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		})

		it('unifies two terms with a variable in the other', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TConst', value: 1 }, { tag: 'TVar', var: 0 }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		})

		it('unifies two terms with a variable in both', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TVar', var: 0 }, { tag: 'TVar', var: 1 }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TVar', var: 1 }]]))
		})

		it('unifies two terms with a variable in both, but with the same variable', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TVar', var: 0 }, { tag: 'TVar', var: 0 }, new Map())
			expect(subst).toEqual(new Map())
		})

		it('unifies two terms with a variable in both, but with the same variable and a substitution', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TVar', var: 0 }, { tag: 'TVar', var: 0 }, new Map([[0, { tag: 'TConst', value: 1 }]]))
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		})
	})

	describe('Sequences', () => {
		it('unified a pair of constant terms', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }] }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }] }, new Map())
			expect(subst).toEqual(new Map())
		})

		it('unified a pair of constant terms with a variable', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }] }, { tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }] }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		})

		it('unified a pair of constant terms with a variable in the other', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }] }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }] }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		})

		it('unified a pair of constant terms with a variable in both', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }] }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TVar', var: 1 }] }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }], [1, { tag: 'TConst', value: 2 }]]))
		})

		it('unified a pair of constant terms with a variable in both, but with the same variable', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }] }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TVar', var: 0 }] }, new Map())
			expect(subst).toBe(undefined)
		})

		it('unified a pair of constant terms with two variable terms on one side', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TVar', var: 1 }] }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }] }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }], [1, { tag: 'TConst', value: 2 }]]))
		})

		it('unifies longer sequences', () => {
			const subst = unify((lhs, rhs) => lhs === rhs, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }, { tag: 'TConst', value: 3 }] }, { tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }, { tag: 'TVar', var: 1 }] }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }], [1, { tag: 'TConst', value: 3 }]]))
		})
	})

	it('Can type check a simple program', () => {
	})
})
