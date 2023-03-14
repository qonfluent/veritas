export type Value = boolean | number | string | bigint

export function valueEqual(lhs: Value, rhs: Value): boolean {
	return lhs === rhs
}

export type Var = number
export type StateStream = { head: State[], tail?: () => StateStream }
export type State = { subst: Subst, fresh: Var }
export type Goal = (state: State) => StateStream
export type Subst = Map<Var, Term>

export type Term
	= { tag: 'TVar', var: Var }
	| { tag: 'TConst', value: Value }
	| { tag: 'TSeq', value: Term[] }
	| { tag: 'TRecord', value: Record<string, Term> }

export function walk(term: Term, subst: Subst): Term {
	switch (term.tag) {
		case 'TVar': {
			const value = subst.get(term.var)
			if (value === undefined) return term
			return walk(value, subst)
		}
		default: return term
	}
}

export function unify(lhs: Term, rhs: Term, subst: Subst): Subst | undefined {
	const leftWalk = walk(lhs, subst)
	const rightWalk = walk(rhs, subst)

	if (leftWalk.tag === 'TVar' && rightWalk.tag === 'TVar' && leftWalk.var === rightWalk.var) {
		return subst
	}

	if (leftWalk.tag === 'TConst' && rightWalk.tag === 'TConst') {
		if (valueEqual(leftWalk.value, rightWalk.value)) {
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

		let result: Subst | undefined = subst
		for (let i = 0; i < leftWalk.value.length; i++)	 {
			result = unify(leftWalk.value[i], rightWalk.value[i], result)
			if (result === undefined) return undefined
		}

		return result
	}

	if (leftWalk.tag === 'TRecord' && rightWalk.tag === 'TRecord') {
		const leftKeys = Object.keys(leftWalk.value)
		const rightKeys = Object.keys(rightWalk.value)
		if (leftKeys.length !== rightKeys.length) return undefined

		let result: Subst | undefined = subst
		for (const key of leftKeys) {
			if (!rightKeys.includes(key)) return undefined
			result = unify(leftWalk.value[key], rightWalk.value[key], result)
			if (result === undefined) return undefined
		}

		return result
	}

	return undefined
}

export function mergeStreams(...streams: StateStream[]): StateStream {
	const heads = streams.flatMap((stream) => stream.head)
	const tails = streams.map((stream) => stream.tail).filter((tail): tail is (() => StateStream) => tail !== undefined)
	return { head: heads, tail: () => mergeStreams(...tails.map((tail) => tail())) }
}

export function bind(stream: StateStream, goal: Goal): StateStream {
	// Get first head from stream, reading tail if necessary
	while (stream.head.length === 0) {
		if (stream.tail === undefined) return { head: [] }
		stream = stream.tail()
	}

	const state = stream.head[0]
	const newStream = goal(state)
	return mergeStreams(newStream, { head: stream.head.slice(1), tail: stream.tail })
}

export function fresh(f: (...ts: Term[]) => Goal): Goal {
	return (state) => {
		const vars: Term[] = [...new Array(f.length)].map((_, i) => ({ tag: 'TVar', var: state.fresh + i }))
		return f(...vars)({ ...state, fresh: state.fresh + f.length })
	}
}

export function disj(...goals: Goal[]): Goal {
	return (state) => {
		const streams = goals.map((goal) => goal(state))
		return mergeStreams(...streams)
	}
}

export function conj(...goals: Goal[]): Goal {
	return (state) => {
		return goals.reduce((stream, goal) => bind(stream, goal), { head: [state] })
	}
}

export function equal(lhs: Term, rhs: Term): Goal {
	return (state) => {
		const subst = unify(lhs, rhs, state.subst)
		if (subst === undefined) return { head: [] }
		return { head: [{ ...state, subst }] }
	}
}

export function notEqual(lhs: Term, rhs: Term): Goal {
	return (state) => {
		const subst = unify(lhs, rhs, state.subst)
		if (subst === undefined) return { head: [state] }
		return { head: [] }
	}
}

export function conde(pairs: [Goal, Goal][]): Goal {
	return disj(...pairs.map(([lhs, rhs]) => conj(lhs, rhs)))
}

describe('Basic unification', () => {
	describe('Constants', () => {
		it('unifies two constant terms', () => {
			const subst = unify({ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 1 }, new Map())
			expect(subst).toEqual(new Map())
		})
	})

	describe('Variables', () => {
		it('unifies two terms with a variable', () => {
			const subst = unify({ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 1 }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		})

		it('unifies two terms with a variable in the other', () => {
			const subst = unify({ tag: 'TConst', value: 1 }, { tag: 'TVar', var: 0 }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		})

		it('unifies two terms with a variable in both', () => {
			const subst = unify({ tag: 'TVar', var: 0 }, { tag: 'TVar', var: 1 }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TVar', var: 1 }]]))
		})

		it('unifies two terms with a variable in both, but with the same variable', () => {
			const subst = unify({ tag: 'TVar', var: 0 }, { tag: 'TVar', var: 0 }, new Map())
			expect(subst).toEqual(new Map())
		})

		it('unifies two terms with a variable in both, but with the same variable and a substitution', () => {
			const subst = unify({ tag: 'TVar', var: 0 }, { tag: 'TVar', var: 0 }, new Map([[0, { tag: 'TConst', value: 1 }]]))
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		})
	})

	describe('Sequences', () => {
		it('unified a pair of constant terms', () => {
			const subst = unify({ tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }] }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }] }, new Map())
			expect(subst).toEqual(new Map())
		})

		it('unified a pair of constant terms with a variable', () => {
			const subst = unify({ tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }] }, { tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }] }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		})

		it('unified a pair of constant terms with a variable in the other', () => {
			const subst = unify({ tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }] }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }] }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		})

		it('unified a pair of constant terms with a variable in both', () => {
			const subst = unify({ tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }] }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TVar', var: 1 }] }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }], [1, { tag: 'TConst', value: 2 }]]))
		})

		it('unified a pair of constant terms with a variable in both, but with the same variable', () => {
			const subst = unify({ tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }] }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TVar', var: 0 }] }, new Map())
			expect(subst).toBe(undefined)
		})

		it('unified a pair of constant terms with two variable terms on one side', () => {
			const subst = unify({ tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TVar', var: 1 }] }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }] }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }], [1, { tag: 'TConst', value: 2 }]]))
		})

		it('unifies longer sequences', () => {
			const subst = unify({ tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 2 }, { tag: 'TConst', value: 3 }] }, { tag: 'TSeq', value: [{ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }, { tag: 'TVar', var: 1 }] }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }], [1, { tag: 'TConst', value: 3 }]]))
		})

		it('unifies a variable with a record', () => {
			const subst = unify({ tag: 'TVar', var: 0 }, { tag: 'TRecord', value: { a: { tag: 'TConst', value: 1 } } }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TRecord', value: { a: { tag: 'TConst', value: 1 } } }]]))
		})

		it('unifies a variable with a record with a variable', () => {
			const subst = unify({ tag: 'TVar', var: 0 }, { tag: 'TRecord', value: { a: { tag: 'TVar', var: 1 } } }, new Map())
			expect(subst).toEqual(new Map([[0, { tag: 'TRecord', value: { a: { tag: 'TVar', var: 1 } } }]]))
		})
	})
})

describe('Combinators', () => {
	it('Can unify with a fresh variable', () => {
		const subst = fresh((t) => equal({ tag: 'TConst', value: 123 }, t))
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 1)
		expect(result.head[0].subst).toEqual(new Map([[0, { tag: 'TConst', value: 123 }]]))
	})

	it('Can perform a disjunction of two terms', () => {
		const subst = disj(equal({ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 1 }), equal({ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }))
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 2)
		expect(result.head[0].subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		expect(result.head[1].subst).toEqual(new Map([[0, { tag: 'TConst', value: 2 }]]))
	})

	it('Can perform a disjunction of three terms', () => {
		const subst = disj(equal({ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 1 }), equal({ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }), equal({ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 3 }))
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 3)
		expect(result.head[0].subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
		expect(result.head[1].subst).toEqual(new Map([[0, { tag: 'TConst', value: 2 }]]))
		expect(result.head[2].subst).toEqual(new Map([[0, { tag: 'TConst', value: 3 }]]))
	})

	it('Can perform a conjunction of two terms', () => {
		const subst = conj(equal({ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 1 }), equal({ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 2 }))
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 0)
	})

	it('Can perform a conjunction of two terms with results', () => {
		const subst = conj(equal({ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 1 }), equal({ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 1 }))
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 1)
		expect(result.head[0].subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }]]))
	})

	it('Can perform a conde', () => {
		const subst = conde([[equal({ tag: 'TVar', var: 0 }, { tag: 'TConst', value: 1 }), equal({ tag: 'TVar', var: 1 }, { tag: 'TConst', value: 2 })]])
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 1)
		expect(result.head[0].subst).toEqual(new Map([[0, { tag: 'TConst', value: 1 }], [1, { tag: 'TConst', value: 2 }]]))
	})
})

describe('Peano', () => {
	const peano = () => {
		const zeroGoal = (x) => equal(x, { tag: 'TConst', value: 0 })
		const succGoal = (x, y) => equal(x, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, y] })
		const natGoal = (x) => disj(zeroGoal(x), fresh((y) => succGoal(x, y)))
		const plusGoal = (x, y, z) => conde([
			[zeroGoal(x), equal(y, z)],
			[succGoal(x, y), fresh((a) => conj(equal(y, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, a] }), plusGoal(a, y, z)))]
		])
		return { natGoal, plusGoal }
	}

	it('Can prove that 0 is a natural number', () => {
		const { natGoal } = peano()
		const subst = natGoal({ tag: 'TConst', value: 0 })
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 1)
		expect(result.head[0].subst).toEqual(new Map())
	})

	it('Can prove that 1 is a natural number', () => {
		const { natGoal } = peano()
		const subst = natGoal({ tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 0 }] })
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 1)
		expect(result.head[0].subst).toEqual(new Map([[0, { tag: 'TConst', value: 0 }]]))
	})

	it('Can prove that 2 is a natural number', () => {
		const { natGoal } = peano()
		const subst = natGoal({ tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 0 }] }] })
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 1)
		expect(result.head[0].subst).toEqual(new Map([[0, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 0 }] }]]))
	})

	it('Can prove that 0 + 0 = 0', () => {
		const { plusGoal } = peano()
		const subst = plusGoal({ tag: 'TConst', value: 0 }, { tag: 'TConst', value: 0 }, { tag: 'TConst', value: 0 })
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 1)
		expect(result.head[0].subst).toEqual(new Map())
	})

	it('Can prove that x = 0 in 1 + x = 1', () => {
		const one = { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 0 }] }
		const { plusGoal } = peano()
		const subst = fresh((x) => plusGoal(one, x, one))
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 1)
		expect(result.head[0].subst).toEqual(new Map([[0, { tag: 'TConst', value: 0 }]]))
	})

	it('Can prove that x = 2 in 1 + 1 = x', () => {
		const one = { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 0 }] }
		const two = { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TSeq', value: [{ tag: 'TConst', value: 1 }, { tag: 'TConst', value: 0 }] }] }
		const { plusGoal } = peano()
		const subst = fresh((x) => plusGoal(one, one, x))
		const result = subst({ subst: new Map(), fresh: 0 })
		expect(result.head.length === 1)
		expect(result.head[0].subst).toEqual(new Map([[0, two]]))
	})
})

describe('Recursion', () => {
	it('Supports recursive calls', () => {
		
	})
})

describe.skip('Lambda calculus', () => {
	const subst = (x, e, t, tsub) => fresh((y, body, e0, e1, e0sub, e1sub) => conde([
		[equal(t, { tag: 'TRecord', value: { lambda: y, body } }), conde([
			[equal(x, y), equal(tsub, t)],
			[notEqual(x, y), fresh((substep) => conj(subst(x, e, body, substep), equal({ tag: 'TRecord', value: { lambda: y, body: substep } }, tsub)))],
		])],
		[equal(t, { tag: 'TRecord', value: { apply: e0, to: e1 } }), conj(
			equal(tsub, { tag: 'TRecord', value: { apply: e0sub, to: e1sub } }),
			subst(x, e, e0, e0sub),
			subst(x, e, e1, e1sub),
		)],
		[equal(t, { tag: 'TRecord', value: { var: y } }), conde([
			[equal(x, y), equal(tsub, e)],
			[notEqual(x, y), equal(tsub, t)],
		])]
	]))

	const step = (term, result) => fresh((e0) => fresh((e1) => fresh((app0) => fresh((app1) => conj(
		equal(term, { tag: 'TRecord', value: { apply: e0, to: e1 } }),
		fresh((x) => fresh((t) => conde([
			[equal(e0, { tag: 'TRecord', value: { lambda: x, body: t } }), subst(x, e1, t, result)],
			[equal(e0, { tag: 'TRecord', value: { apply: app0, to: app1 } }), fresh((substep) => conj(step(e0, substep), equal({ tag: 'TRecord', value: { apply: substep, to: e1 } }, result)))],
		])))
	)))))

	const whnf = (e, result) => fresh((x) => fresh((t) => fresh((e0) => fresh((e1) => conde([
		[equal(e, { tag: 'TRecord', value: { lambda: x, body: t } }), equal(e, result)],
		[equal(e, { tag: 'TRecord', value: { apply: e0, to: e1 } }), fresh((substep) => conj(step(e, substep), whnf(substep, result)))]
	])))))

	it('Can evaluate a simple term', () => {
		const testId = { lambda: 'x', body: { var: 'x' } }
		const testProg = { app: testId, to: testId }
		const subst = fresh((x) => step(testId, x))
		const result = subst({ subst: new Map(), fresh: 0 })
		console.log(result)
	})
})
