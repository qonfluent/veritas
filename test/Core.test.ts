import { Tag } from '../src/core/AST'
import { Goal, State, eq, conj, disj, exists } from '../src/core/Goals'
import { take } from '../src/core/Stream'

export function run(n: number, goal: Goal): State[] {
	const state = { env: {}, free: 0 }
	const stream = goal(state)
	return take(n, stream)
}

describe('Core', () => {
	describe('Unification', () => {
		describe('Literals', () => {
			it('should unify literals', () => {
				const goal = eq([Tag.Lit, 1], [Tag.Lit, 1])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})

			it('should fail to unify literals', () => {
				const goal = eq([Tag.Lit, 1], [Tag.Lit, 2])
				const states = run(10, goal)
				expect(states).toEqual([])
			})
		})

		describe('Variables', () => {
			it('should unify variables', () => {
				const goal = eq([Tag.Var, 'x'], [Tag.Var, 'y'])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map([['x', [Tag.Var, 'y']]]), free: 0 }])
			})

			it('should unify variables with literals', () => {
				const goal = eq([Tag.Var, 'x'], [Tag.Lit, 1])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map([['x', [Tag.Lit, 1]]]), free: 0 }])
			})

			it('should unify variables with literals (2)', () => {
				const goal = eq([Tag.Lit, 1], [Tag.Var, 'x'])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map([['x', [Tag.Lit, 1]]]), free: 0 }])
			})
		})

		describe('Nil', () => {
			it('should unify nil', () => {
				const goal = eq([Tag.Nil], [Tag.Nil])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})

			it('should unify nil with variables', () => {
				const goal = eq([Tag.Nil], [Tag.Var, 'x'])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map([['x', [Tag.Nil]]]), free: 0 }])
			})

			it('should not unify nil with cons', () => {
				const goal = eq([Tag.Nil], [Tag.Cons, [Tag.Lit, 1], [Tag.Nil]])
				const states = run(10, goal)
				expect(states).toEqual([])
			})
		})

		describe('Cons', () => {
			it('should unify cons', () => {
				const goal = eq([Tag.Cons, [Tag.Lit, 1], [Tag.Nil]], [Tag.Cons, [Tag.Lit, 1], [Tag.Nil]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})

			it('should unify cons with variables', () => {
				const goal = eq([Tag.Cons, [Tag.Var, 'x'], [Tag.Var, 'y']], [Tag.Cons, [Tag.Var, 'x'], [Tag.Var, 'y']])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})

			it('should unify cons with literals and variables', () => {
				const goal = eq([Tag.Cons, [Tag.Lit, 1], [Tag.Nil]], [Tag.Cons, [Tag.Var, 'x'], [Tag.Var, 'y']])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map([['x', [Tag.Lit, 1]], ['y', [Tag.Nil]]]), free: 0 }])
			})

			it('should unify improper cons', () => {
				const goal = eq([Tag.Cons, [Tag.Lit, 1], [Tag.Lit, 2]], [Tag.Cons, [Tag.Var, 'x'], [Tag.Var, 'y']])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map([['x', [Tag.Lit, 1]], ['y', [Tag.Lit, 2]]]), free: 0 }])
			})

			it('should fail to unify with nil', () => {
				const goal = eq([Tag.Cons, [Tag.Lit, 1], [Tag.Nil]], [Tag.Nil])
				const states = run(10, goal)
				expect(states).toEqual([])
			})
		})
	})

	describe('Conjunctions', () => {
		it('Should solve conjunctions with zero terms', () => {
			const goal = conj()
			const states = run(10, goal)
			expect(states).toEqual([{ env: new Map(), free: 0 }])
		})

		it('Should solve conjunctions with one term', () => {
			const goal = conj(eq([Tag.Lit, 1], [Tag.Lit, 1]))
			const states = run(10, goal)
			expect(states).toEqual([{ env: new Map(), free: 0 }])
		})

		it('Should solve conjunctions with two terms', () => {
			const goal = conj(eq([Tag.Lit, 1], [Tag.Lit, 1]), eq([Tag.Lit, 2], [Tag.Lit, 2]))
			const states = run(10, goal)
			expect(states).toEqual([{ env: new Map(), free: 0 }])
		})

		it('Should solve conjunctions with two terms, one of which is false', () => {
			const goal = conj(eq([Tag.Lit, 1], [Tag.Lit, 1]), eq([Tag.Lit, 2], [Tag.Lit, 3]))
			const states = run(10, goal)
			expect(states).toEqual([])
		})

		it('Should solve conjunctions with two terms, both of which are false', () => {
			const goal = conj(eq([Tag.Lit, 1], [Tag.Lit, 2]), eq([Tag.Lit, 2], [Tag.Lit, 3]))
			const states = run(10, goal)
			expect(states).toEqual([])
		})
	})

	describe('Disjunctions', () => {
		it('Should solve disjunctions with zero terms', () => {
			const goal = disj()
			const states = run(10, goal)
			expect(states).toEqual([])
		})

		it('Should solve disjunctions with one term', () => {
			const goal = disj(eq([Tag.Lit, 1], [Tag.Lit, 1]))
			const states = run(10, goal)
			expect(states).toEqual([{ env: new Map(), free: 0 }])
		})

		it('Should solve disjunctions with two terms', () => {
			const goal = disj(eq([Tag.Lit, 1], [Tag.Lit, 1]), eq([Tag.Lit, 2], [Tag.Lit, 2]))
			const states = run(10, goal)
			expect(states).toEqual([{ env: new Map(), free: 0 }, { env: new Map(), free: 0 }])
		})

		it('Should solve disjunctions with two terms, one of which is false', () => {
			const goal = disj(eq([Tag.Lit, 1], [Tag.Lit, 1]), eq([Tag.Lit, 2], [Tag.Lit, 3]))
			const states = run(10, goal)
			expect(states).toEqual([{ env: new Map(), free: 0 }])
		})

		it('Should solve disjunctions with two terms, both of which are false', () => {
			const goal = disj(eq([Tag.Lit, 1], [Tag.Lit, 2]), eq([Tag.Lit, 2], [Tag.Lit, 3]))
			const states = run(10, goal)
			expect(states).toEqual([])
		})
	})

	describe('Exists', () => {
		it('Should solve exists with zero vars', () => {
			const goal = exists(() => eq([Tag.Lit, 1], [Tag.Lit, 1]))
			const states = run(10, goal)
			expect(states).toEqual([{ env: new Map(), free: 0 }])
		})

		it('Should solve exists with one var', () => {
			const goal = exists((x) => eq([Tag.Lit, 1], x))
			const states = run(10, goal)
			expect(states).toEqual([{ env: new Map([['@gensym(0)', [Tag.Lit, 1]]]), free: 1 }])
		})

		it('Should solve exists with two vars', () => {
			const goal = exists((x, y) => conj(eq([Tag.Lit, 1], x), eq([Tag.Lit, 2], y)))
			const states = run(10, goal)
			expect(states).toEqual([{ env: new Map([['@gensym(0)', [Tag.Lit, 1]], ['@gensym(1)', [Tag.Lit, 2]]]), free: 2 }])
		})
	})
})
