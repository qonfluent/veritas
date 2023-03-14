export type Term
	= { var: string }
	| { lit: string | number | boolean | bigint }
	| { seq: Term[] }
	| { set: Term[] }
	| { map: [Term, Term][] }

export type Subst = { [x: string]: Term }
export type State = { env: Subst, fresh: number }
export type StateStream = { head: State[], tail?: () => StateStream }
export type Goal = (state: State) => StateStream

export function walk(term: Term, subst: Subst): Term {
	while ('var' in term) {
		const value = subst[term.var]
		if (value) {
			term = value
		} else {
			return term
		}
	}

	return term
}

export function unify(lhs: Term, rhs: Term, subst: Subst): Subst | undefined {
	const left = walk(lhs, subst)
	const right = walk(rhs, subst)

	if ('var' in left && 'var' in right && left.var === right.var) {
		return subst
	} else if ('var' in left) {
		return { ...subst, [left.var]: right }
	} else if ('var' in right) {
		return { ...subst, [right.var]: left }
	} else if ('lit' in left && 'lit' in right && left.lit === right.lit) {
		return subst
	} else if ('seq' in left && 'seq' in right) {
		if (left.seq.length !== right.seq.length) {
			return undefined
		}

		let result: Subst | undefined = subst
		for (let i = 0; i < left.seq.length; i++) {
			result = unify(left.seq[i], right.seq[i], result)
			if (!result) {
				return undefined
			}
		}

		return result
	} else if ('set' in left && 'set' in right) {
		if (left.set.length !== right.set.length) {
			return undefined
		}

		let result: Subst | undefined = subst
		for (let i = 0; i < left.set.length; i++) {
			result = unify(left.set[i], right.set[i], result)
			if (!result) {
				return undefined
			}
		}

		return result
	} else if ('map' in left && 'map' in right) {
		if (left.map.length !== right.map.length) {
			return undefined
		}

		let result: Subst | undefined = subst
		for (let i = 0; i < left.map.length; i++) {
			result = unify(left.map[i][0], right.map[i][0], result)
			if (!result) {
				return undefined
			}

			result = unify(left.map[i][1], right.map[i][1], result)
			if (!result) {
				return undefined
			}
		}

		return result
	} else {
		return undefined
	}
}

export function mergeStreams(...streams: StateStream[]): StateStream {
	const heads = streams.flatMap((stream) => stream.head)
	const tails = streams.map((stream) => stream.tail).filter((tail): tail is (() => StateStream) => tail !== undefined)
	return { head: heads, tail: () => mergeStreams(...tails.map((tail) => tail())) }
}

export function bind(stream: StateStream, goal: Goal): StateStream {
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

export function run(n: number, goal: Goal): State[] {
	let stream = goal({ env: {}, fresh: 0 })
	const results: State[] = []
	for (let i = 0; i < n; i++) {
		if (stream.head.length === 0) {
			if (stream.tail === undefined) {
				break
			}

			stream = stream.tail()
		}

		if (stream.head.length === 0) {
			break
		}

		results.push(stream.head[0])
		stream = { head: stream.head.slice(1), tail: stream.tail }
	}

	return results
}

export function succeed(state: State): StateStream {
	return { head: [state] }
}

export function fail(state: State): StateStream {
	return { head: [] }
}

export function eq(lhs: Term, rhs: Term): Goal {
	return (state) => {
		const env = unify(lhs, rhs, state.env)
		if (env) {
			return succeed({ env, fresh: state.fresh })
		} else {
			return fail(state)
		}
	}
}

export function neq(lhs: Term, rhs: Term): Goal {
	return (state) => {
		const env = unify(lhs, rhs, state.env)
		if (env) {
			return fail(state)
		} else {
			return succeed(state)
		}
	}
}

export function fresh(func: (...vars: Term[]) => Goal): Goal {
	return (state) => {
		const vars: Term[] = [...new Array(func.length)].map((_, i) => ({ var: `%${state.fresh + i}` }))
		return func(...vars)({ env: state.env, fresh: state.fresh + func.length })
	}
}

export function conj(...goals: Goal[]): Goal {
	return (state) => {
		let stream = succeed(state)
		for (const goal of goals) {
			stream = bind(stream, goal)
		}

		return stream
	}
}

export function disj(...goals: Goal[]): Goal {
	return (state) => {
		let stream = fail(state)
		for (const goal of goals) {
			const t = goal(state)
			console.log(t)
			stream = mergeStreams(stream, t)
		}

		return stream
	}
}

export function conde(...goals: Goal[][]): Goal {
	return disj(...goals.map((goal) => conj(...goal)))
}

describe('Walk', () => {
	it('should walk to const', () => {
		const term = { var: 'x' }
		const subst = { x: { lit: 1 } }
		const result = walk(term, subst)
		expect(result).toEqual({ lit: 1 })
	})

	it('should walk to var', () => {
		const term = { var: 'x' }
		const subst = { x: { var: 'y' } }
		const result = walk(term, subst)
		expect(result).toEqual({ var: 'y' })
	})
})

describe('Unify', () => {
	describe('Positive tests', () => {
		it('Should unify two variables', () => {
			const lhs = { var: 'x' }
			const rhs = { var: 'y' }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toEqual({ x: { var: 'y' } })
		})

		describe('Should unify two constants', () => {
			it('Should unify two numbers', () => {
				const lhs = { lit: 1 }
				const rhs = { lit: 1 }
				const subst = {}
				const result = unify(lhs, rhs, subst)
				expect(result).toEqual({})
			})

			it('Should unify two strings', () => {
				const lhs2 = { lit: 'a' }
				const rhs2 = { lit: 'a' }
				const subst2 = {}
				const result2 = unify(lhs2, rhs2, subst2)
				expect(result2).toEqual({})
			})

			it('Should unify two booleans', () => {
				const lhs3 = { lit: true }
				const rhs3 = { lit: true }
				const subst3 = {}
				const result3 = unify(lhs3, rhs3, subst3)
				expect(result3).toEqual({})
			})

			it('Should unify two bigints', () => {
				const lhs4 = { lit: BigInt(1) }
				const rhs4 = { lit: BigInt(1) }
				const subst4 = {}
				const result4 = unify(lhs4, rhs4, subst4)
				expect(result4).toEqual({})
			})
		})

		it('Should unify two sequences', () => {
			const lhs = { seq: [{ lit: 1 }, { lit: 2 }] }
			const rhs = { seq: [{ lit: 1 }, { lit: 2 }] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toEqual({})
		})

		it('Should unify two sets', () => {
			const lhs = { set: [{ lit: 1 }, { lit: 2 }] }
			const rhs = { set: [{ lit: 1 }, { lit: 2 }] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toEqual({})
		})

		it('Should unify two maps', () => {
			const lhs: Term = { map: [[{ lit: 1 }, { lit: 2 }], [{ lit: 3 }, { lit: 4 }]] }
			const rhs: Term = { map: [[{ lit: 1 }, { lit: 2 }], [{ lit: 3 }, { lit: 4 }]] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toEqual({})
		})

		it('Should unify two sequences with variables', () => {
			const lhs = { seq: [{ var: 'x' }, { lit: 2 }] }
			const rhs = { seq: [{ lit: 1 }, { lit: 2 }] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toEqual({ x: { lit: 1 } })
		})

		it('Should unify two sets with variables', () => {
			const lhs = { set: [{ var: 'x' }, { lit: 2 }] }
			const rhs = { set: [{ lit: 1 }, { lit: 2 }] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toEqual({ x: { lit: 1 } })
		})

		it('Should unify two maps with variables', () => {
			const lhs: Term = { map: [[{ var: 'x' }, { lit: 2 }], [{ lit: 3 }, { lit: 4 }]] }
			const rhs: Term = { map: [[{ lit: 1 }, { lit: 2 }], [{ lit: 3 }, { lit: 4 }]] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toEqual({ x: { lit: 1 } })
		})
	})

	describe('Negative tests', () => {
		describe('Should fail to unify two different constants', () => {
			it('Should fail to unify two numbers', () => {
				const lhs = { lit: 1 }
				const rhs = { lit: 2 }
				const subst = {}
				const result = unify(lhs, rhs, subst)
				expect(result).toBeUndefined()
			})

			it('Should fail to unify two strings', () => {
				const lhs2 = { lit: 'a' }
				const rhs2 = { lit: 'b' }
				const subst2 = {}
				const result2 = unify(lhs2, rhs2, subst2)
				expect(result2).toBeUndefined()
			})

			it('Should fail to unify two booleans', () => {
				const lhs3 = { lit: true }
				const rhs3 = { lit: false }
				const subst3 = {}
				const result3 = unify(lhs3, rhs3, subst3)
				expect(result3).toBeUndefined()
			})

			it('Should fail to unify two bigints', () => {
				const lhs4 = { lit: BigInt(1) }
				const rhs4 = { lit: BigInt(2) }
				const subst4 = {}
				const result4 = unify(lhs4, rhs4, subst4)
				expect(result4).toBeUndefined()
			})
		})

		it('Should fail to unify two sequences', () => {
			const lhs = { seq: [{ lit: 1 }, { lit: 2 }] }
			const rhs = { seq: [{ lit: 1 }, { lit: 3 }] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toBeUndefined()
		})

		it('Should fail to unify two sets', () => {
			const lhs = { set: [{ lit: 1 }, { lit: 2 }] }
			const rhs = { set: [{ lit: 1 }, { lit: 3 }] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toBeUndefined()
		})

		it('Should fail to unify two maps', () => {
			const lhs: Term = { map: [[{ lit: 1 }, { lit: 2 }], [{ lit: 3 }, { lit: 4 }]] }
			const rhs: Term = { map: [[{ lit: 1 }, { lit: 2 }], [{ lit: 3 }, { lit: 5 }]] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toBeUndefined()
		})

		it('Should fail to unify two sequences with variables', () => {
			const lhs = { seq: [{ var: 'x' }, { lit: 2 }] }
			const rhs = { seq: [{ lit: 1 }, { lit: 3 }] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toBeUndefined()
		})

		it('Should fail to unify two sets with variables', () => {
			const lhs = { set: [{ var: 'x' }, { lit: 2 }] }
			const rhs = { set: [{ lit: 1 }, { lit: 3 }] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toBeUndefined()
		})

		it('Should fail to unify two maps with variables', () => {
			const lhs: Term = { map: [[{ var: 'x' }, { lit: 2 }], [{ lit: 3 }, { lit: 4 }]] }
			const rhs: Term = { map: [[{ lit: 1 }, { lit: 2 }], [{ lit: 3 }, { lit: 5 }]] }
			const subst = {}
			const result = unify(lhs, rhs, subst)
			expect(result).toBeUndefined()
		})
	})
})

describe('Goals', () => {
	it('Should perform success goal', () => {
		const result = run(100, succeed)
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})

	it('Should perform fail goal', () => {
		const result = run(100, fail)
		expect(result).toEqual([])
	})

	it('Should perform disjunction goal', () => {
		const result = run(100, disj(succeed, succeed))
		expect(result).toEqual([{ env: {}, fresh: 0 }, { env: {}, fresh: 0 }])
	})

	it('Should perform disjunction goal with fail', () => {
		const result = run(100, disj(fail, succeed))
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})
	
	it('Should perform disjunction goal with two fails', () => {
		const result = run(100, disj(fail, fail))
		expect(result).toEqual([])
	})

	it('Should perform a conjuction goal', () => {
		const result = run(100, conj(succeed, succeed))
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})

	it('Should perform a conjuction goal with fail', () => {
		const result = run(100, conj(fail, succeed))
		expect(result).toEqual([])
	})

	it('Should perform a conjuction goal with two fails', () => {
		const result = run(100, conj(fail, fail))
		expect(result).toEqual([])
	})

	it('Should check equality', () => {
		const result = run(100, eq({ lit: 1 }, { lit: 1 }))
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})

	it('Should check negative equality', () => {
		const result = run(100, eq({ lit: 1 }, { lit: 2 }))
		expect(result).toEqual([])
	})

	it('Should check equality with variables', () => {
		const result = run(100, eq({ var: 'x' }, { lit: 1 }))
		expect(result).toEqual([{ env: { x: { lit: 1 } }, fresh: 0 }])
	})

	it('Should check inequality', () => {
		const result = run(100, neq({ lit: 1 }, { lit: 2 }))
		expect(result).toEqual([{ env: {}, fresh: 0 }])
	})

	it('Should check negative inequality', () => {
		const result = run(100, neq({ lit: 1 }, { lit: 1 }))
		expect(result).toEqual([])
	})

	it('Should check inequality with variables', () => {
		const result = run(100, neq({ var: 'x' }, { lit: 1 }))
		expect(result).toEqual([])
	})
})
