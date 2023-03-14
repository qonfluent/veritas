import assert from "assert"

export type Term = string | unknown
export type Subst = Record<string, Term>

export function walk(term: Term, subst: Subst): Term {
	if (typeof term === 'symbol') {
		const value = subst[term.description ?? '']
		return value === undefined ? term : walk(value, subst)
	}
	
	return term
}

export function occursCheck(varName: symbol, term: Term): boolean {
	if (typeof term === 'symbol') {
		return term === varName
	} else if (Array.isArray(term)) {
		return term.some((t) => occursCheck(varName, t))
	} else {
		return false
	}
}

export function unify(subst: Subst, lhsRaw: Term, rhsRaw: Term): Subst[] | Error {
	const lhs = walk(lhsRaw, subst)
	const rhs = walk(rhsRaw, subst)
	
	if (lhs === rhs) {
		return [subst]
	} else if (typeof lhs === 'symbol') {
		// if (occursCheck(lhs, rhs)) {
		// 	return new Error(`Cannot unify ${String(lhs)} with ${rhs} (occurs check failed)`)
		// }

		return [{ ...subst, [lhs.description ?? '']: rhs }]
	} else if (typeof rhs === 'symbol') {
		// if (occursCheck(rhs, lhs)) {
		// 	return new Error(`Cannot unify ${lhs} with ${String(rhs)} (occurs check failed)`)
		// }

		return [{ ...subst, [rhs.description ?? '']: lhs }]
	} else if (Array.isArray(lhs) && Array.isArray(rhs)) {
		return unifyArray(subst, lhs, rhs)
	} else if (lhs instanceof Uint8Array && rhs instanceof Uint8Array) {
		return Buffer.compare(lhs, rhs) === 0 ? [subst] : new Error(`Cannot unify ${lhs} with ${rhs}`)
	} else {
		return new Error(`Cannot unify ${JSON.stringify(lhs)} with ${JSON.stringify(rhs)}`)
	}
}

export function unifyArray(subst: Subst, lhs: Term[], rhs: Term[]): Subst[] | Error {
	if (lhs.length !== rhs.length) {
		return new Error(`Cannot unify ${lhs} with ${rhs} (length mismatch)\nExpected ${lhs.length}, but got ${rhs.length}`)
	}

	// For each entry, generate a unified substitution
	const unifications = lhs.map((lhs, i) => unify(subst, lhs, rhs[i]))
	
	// Bail if any of the unifications failed
	if (unifications.some((u) => u instanceof Error)) {
		return new Error(`Array unification generated the following errors: ${unifications.find((u) => u instanceof Error)}`)
	}

	// Find all permutations of the unified substitutions
	const permutations = unifications.reduce<Subst[]>((acc, u) => {
		// For each unification, for each substitution, add the extension of the substitution for each unification
		// i.e. reduce on unifications, for each sub in the unification, add that sub to each sub in acc
		assert(u instanceof Array)
		return acc.flatMap((sub) => u.map((u) => ({ ...sub, ...u })))
	}, [subst])

	return permutations
}

export type Stream<A> = { head: A[], tail?: () => Stream<A> }

export function mergeStreams<A>(...streams: Stream<A>[]): Stream<A> {
	const head = streams.flatMap((s) => s.head)
	const tails = streams.flatMap((s) => s.tail ?? [])
	return { head, tail: () => mergeStreams(...tails.map((t) => t())) }
}

export type State = { env: Subst, fresh: number }
export type Goal = (state: State) => Stream<State>

export function bind(stream: Stream<State>, goal: Goal): Stream<State> {
	while (stream.head.length === 0) {
		if (stream.tail === undefined) {
			return { head: [] }
		}

		stream = stream.tail()
	}

	const head = stream.head.map(goal)
	const tail = () => bind(stream.tail ? stream.tail() : { head: [] }, goal)
	return mergeStreams(...head, { head: [], tail })
}

// Run a goal, returning the first n results
export function run(goal: Goal, count: number = 1): State[] {
	let stream = goal({ env: {}, fresh: 0 })

	// For each of the count entries
	const results: State[] = []
	for (let i = 0; i < count; i++) {
		// If we can pull it from the head, do that
		if (stream.head.length > 0) {
			results.push(stream.head[0])
			stream.head = stream.head.slice(1)
		} else if (stream.tail) {
			// Otherwise, if we have a tail, pull from that
			stream = stream.tail()
		} else {
			// Otherwise, we're done
			break
		}
	}

	return results
}

export function eq(lhs: Term, rhs: Term): Goal {
	return (state) => {
		const result = unify(state.env, lhs, rhs)
		if (result instanceof Error) {
			return { head: [] }
		}

		return { head: result.map((env) => ({ ...state, env })) }
	}
}

export function neq(lhs: Term, rhs: Term): Goal {
	return (state) => {
		const result = unify(state.env, lhs, rhs)
		if (result instanceof Error) {
			return { head: [state] }
		}

		return { head: [] }
	}
}

export function fresh<A>(f: (...args: Term[]) => Goal): Goal {
	return (state) => {
		const args = [...new Array(f.length)].map(() => Symbol(`@genvar(${state.fresh++})`))
		return f(...args)(state)
	}
}

export function conj(...goals: Goal[]): Goal {
	return (state) => {
		let stream = { head: [state] }
		for (const goal of goals) {
			stream = bind(stream, goal)
		}

		return stream
	}
}

export function disj(...goals: Goal[]): Goal {
	return (state) => {
		let stream: Stream<State> = { head: [] }
		for (const goal of goals) {
			stream = mergeStreams(stream, goal(state))
		}

		return stream
	}
}

export function snooze(goal: () => Goal): Goal {
	return (state) => {
		return goal()(state)
	}
}

describe('unify', () => {
	describe('simple negative', () => {
		it('should fail to unify two unequal booleans', () => {
			const result = unify({}, true, false)
			expect(result).toEqual(new Error('Cannot unify true with false'))
		})

		it('should fail to unify two unequal numbers', () => {
			const result = unify({}, 1, 2)
			expect(result).toEqual(new Error('Cannot unify 1 with 2'))
		})

		it('should fail to unify two unequal strings', () => {
			const result = unify({}, 'a', 'b')
			expect(result).toEqual(new Error('Cannot unify "a" with "b"'))
		})

		it('should fail to unify two unequal arrays', () => {
			const result = unify({}, [1, 2, 3], [1, 2, 3, 4])
			expect(result).toEqual(new Error('Cannot unify 1,2,3 with 1,2,3,4 (length mismatch)\nExpected 3, but got 4'))
		})

		it('should fail to unify two unequal arrays', () => {
			const result = unify({}, [1, 2, 3], [1, 2, 4])
			expect(result).toEqual(new Error('Array unification generated the following errors: Error: Cannot unify 3 with 4'))
		})
	})

	describe('simple positive', () => {
		it('should unify two equal booleans', () => {
			const result = unify({}, true, true)
			expect(result).toEqual([{}])
		})

		it('should unify two equal numbers', () => {
			const result = unify({}, 1, 1)
			expect(result).toEqual([{}])
		})

		it('should unify two equal strings', () => {
			const result = unify({}, 'a', 'a')
			expect(result).toEqual([{}])
		})

		it('should unify two equal arrays', () => {
			const result = unify({}, [1, 2, 3], [1, 2, 3])
			expect(result).toEqual([{}])
		})
	})

	describe('variable positive', () => {
		it('should unify a variable with a number', () => {
			const result = unify({}, Symbol('x'), 1)
			expect(result).toEqual([{ x: 1 }])
		})

		it('should unify a variable with a string', () => {
			const result = unify({}, Symbol('x'), 'a')
			expect(result).toEqual([{ x: 'a' }])
		})

		it('should unify a variable with a boolean', () => {
			const result = unify({}, Symbol('x'), true)
			expect(result).toEqual([{ x: true }])
		})

		it('should unify a variable with an array', () => {
			const result = unify({}, Symbol('x'), [1, 2, 3])
			expect(result).toEqual([{ x: [1, 2, 3] }])
		})

		it('Should unify a variable with another variable', () => {
			const ySym = Symbol('y')
			const result = unify({}, Symbol('x'), ySym)
			expect(result).toEqual([{ x: ySym }])
		})

		it('should unify a variable with a variable that is unified with a number', () => {
			const result = unify({ y: 1 }, Symbol('x'), Symbol('y'))
			expect(result).toEqual([{ x: 1, y: 1 }])
		})

		it('should unify a variable with a constantwhile inside an array', () => {
			const result = unify({}, [Symbol('x')], [1])
			expect(result).toEqual([{ x: 1 }])
		})

		it('should unify two variables while inside an array', () => {
			const ySym = Symbol('y')
			const result = unify({}, [Symbol('x')], [ySym])
			expect(result).toEqual([{ x: ySym }])
		})
	})
})

describe('goals', () => {
	it('can run a simple equality', () => {
		const result = run(eq(1, 1))
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})

	it('can run a simple inequality', () => {
		const result = run(neq(1, 2))
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})

	it('can run fresh', () => {
		const result = run(fresh((x) => eq(x, 1)))
		expect(result).toEqual([{ env: { '@genvar(0)': 1 }, fresh: 1 }])
	})

	it('can run fresh twice', () => {
		const result = run(fresh((x, y) => conj(eq(x, 1), eq(y, 2))))
		expect(result).toEqual([{ env: { '@genvar(0)': 1, '@genvar(1)': 2 }, fresh: 2 }])
	})

	it('can run a conjunction', () => {
		const result = run(conj(eq(1, 1), eq(2, 2)))
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})

	it('can run a disjunction', () => {
		const result = run(disj(eq(1, 1), eq(2, 3)))
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})

	it('can run a disjunction with a failure', () => {
		const result = run(disj(eq(1, 2), eq(2, 3)))
		expect(result).toEqual([])
	})

	it('can run a disjunction with a failure and a success', () => {
		const result = run(disj(eq(1, 2), eq(2, 2)))
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})
})

describe('peano axioms', () => {
	const isNat = (n) => disj(
		eq(n, 0),
		fresh((m) => conj(
			eq(n, [1, m]),
			snooze(() => isNat(m)),
		)),
	)

	it('can prove 0 is a natural number', () => {
		const result = run(isNat(0))
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})

	it('can prove 1 is a natural number', () => {
		const result = run(isNat(1))
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})
})
