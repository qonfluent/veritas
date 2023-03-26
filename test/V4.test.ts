export type Literal = Uint8Array | string
export type Var = number
export type Term = Literal | Var | [] | [Term, Term]
export type Machine = { env: Term[] }
export type Goal = (m: Machine, cb: (m: Machine) => void) => void

export function conj(...goals: Goal[]): Goal {
	return (m, cb) => {
		for (let i = 0; i < goals.length; i++) {
			goals[i](m, (newState) => m = newState)
		}
		cb(m)
	}
}

export function disj(...goals: Goal[]): Goal {
	return (m, cb) => {
		for (let i = 0; i < goals.length; i++) {
			goals[i](m, cb)
		}
	}
}

export function exists(f: (...args: Term[]) => Goal): Goal {
	return (m, cb) => {
		const vars = [...new Array(f.length)].map((_, i) => i + m.env.length)
		f(...vars)(m, cb)
	}
}

function walk(env: Term[], term: Term): Term {
	while (typeof term === 'number') {
		const value = env[term]
		if (value === undefined) return term
		term = value
	}
	return term
}

export function eq(lhs: Term, rhs: Term): Goal {
	return (m, cb) => {
		rhs = walk(m.env, rhs)
		lhs = walk(m.env, lhs)

		if (lhs instanceof Uint8Array && rhs instanceof Uint8Array) {
			if (Buffer.compare(lhs, rhs) === 0) cb(m)
		} else if (typeof lhs === 'string' && typeof rhs === 'string') {
			if (lhs === rhs) cb(m)
		} else if (typeof lhs === 'number' && typeof rhs === 'number') {
			if (lhs === rhs) cb(m)
			else {
				m.env[lhs] = rhs
				cb(m)
			}
		} else if (typeof lhs === 'number') {
			m.env[lhs] = rhs
			cb(m)
		} else if (typeof rhs === 'number') {
			m.env[rhs] = lhs
			cb(m)
		} else if (lhs.length === 0 && rhs.length === 0) {
			cb(m)
		} else if (lhs.length === 2 && rhs.length === 2) {
			eq(lhs[0], rhs[0])(m, (newState) => {
				eq(lhs[1], rhs[1])(newState, cb)
			})
		}
	}
}

export type Language = {
	rules: [Term, Term][]
}

export type Program = {
	language: Language
	state: Term
}

export function raise(term: Term, n: number = 1): Term {
	if (n === 0) return term
	if (term instanceof Uint8Array) return term
	if (typeof term === 'string') return term
	if (typeof term === 'number') return term + n
	if (term.length === 0) return []
	return [raise(term[0], n), raise(term[1], n)]
}

export function compile(program: Program): Goal {
	const { language, state } = program
	const rules = language.rules.map(([before, after]): [Term, Term] => [raise(before, 2), raise(after, 2)])

	return exists((oldState, newState) => {
		return conj(
			eq(state, oldState),
			disj(...rules.map((rule) => eq(rule, [oldState, newState]))),
		)
	})
}

export function run(goal: Goal): Machine[] {
	const states: Machine[] = []
	goal({ env: [] }, (m) => states.push(m))
	return states
}

export function fullWalk(env: Term[], term: Term): Term {
	if (term instanceof Uint8Array) return term
	if (typeof term === 'string') return term
	if (typeof term === 'number') return walk(env, term)
	if (term.length === 0) return []
	return [fullWalk(env, term[0]), fullWalk(env, term[1])]
}

export function consify(...terms: Term[]): Term {
	return terms.reduceRight((acc, term) => [term, acc], [])
}

export function step(program: Program): Program[] {
	const { language, state } = program
	const goal = compile(program)
	const states = run(goal)
	return states.map((state) => ({
		language,
		state: fullWalk(state.env, state.env[1]),
	})

describe('Machine', () => {
	describe('Unify', () => {
		it('Can unify two literals', () => {
			const states = run(eq(Buffer.from('foo'), Buffer.from('foo')))
			expect(states).toEqual([{ env: [] }])
		})

		it('Can unify two different variables', () => {
			const states = run(eq(0, 1))
			expect(states).toEqual([{ env: [1] }])
		})

		it('Can unify two equal variables', () => {
			const states = run(eq(0, 0))
			expect(states).toEqual([{ env: [] }])
		})

		it('Can unify a variable with a literal', () => {
			const states = run(eq(0, Buffer.from('foo')))
			expect(states).toEqual([{ env: [Buffer.from('foo')] }])
		})

		it('Can unify nil', () => {
			const states = run(eq([], []))
			expect(states).toEqual([{ env: [] }])
		})

		it('Can unify a pair with all variables', () => {
			const states = run(eq([0, 1], [2, 3]))
			expect(states).toEqual([{ env: [2, 3] }])
		})

		it('Can unify a pair with a variable and a literal on each side', () => {
			const states = run(eq([0, Buffer.from('foo')], [Buffer.from('bar'), 1]))
			expect(states).toEqual([{ env: [Buffer.from('bar'), Buffer.from('foo')] }])
		})

		it('Can unify a pair with a variable and a pair on each side', () => {
			const states = run(eq([0, [1, 2]], [[3, 4], 5]))
			expect(states).toEqual([{ env: [[3, 4], undefined, undefined, undefined, undefined, [1, 2]] }])
		})
	})

	describe('Step', () => {
		it('Can step a program(empty)', () => {
			const prog: Program = { language: { rules: [] }, state: [0, 1] }
			const states = run(compile(prog))
			expect(states).toEqual([{ env: [[0, 1]] }])
		})

		it('Can step a program(swap)', () => {
			const prog: Program = {
				language: {
					rules: [
						[[0, 1], [1, 0]]
					],
				},
				state: [Buffer.from('foo'), Buffer.from('bar')],
			}

			const states = run(compile(prog))
			expect(states).toEqual([
				{ env: [[Buffer.from('foo'), Buffer.from('bar')], [3, 2], Buffer.from('foo'), Buffer.from('bar')] },
			])
		})

		it('Can step a program(append)', () => {
			const state = consify('append', consify('foo', 'bar'), consify('baz', 'qux'))

			const prog: Program = {
				language: {
					rules: [
						[consify('append', [], 0), 0],
						[consify('append', [0, 1], 2), [0, consify('append', 1, 2)]],
					]
				},
				state,
			}

			const states = run(compile(prog))
			expect(states.length).toBe(1)
			expect(states[0].env[0]).toEqual(state)
			expect(fullWalk(states[0].env, states[0].env[1])).toEqual(['foo', ['append', [['bar', []], [['baz', ['qux', []]], []]]]])
		})
	})
})
