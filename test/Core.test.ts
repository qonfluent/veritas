import { Tag } from '../src/core/AST'
import { Goal, State, eq, conj, disj, exists } from '../src/core/Goals'
import { take } from '../src/core/Stream'

export function run(n: number, goal: Goal): State[] {
	const state = { env: new Map(), free: 0 }
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
		
		describe('Sequences', () => {
			it('should unify sequences of constants', () => {
				const goal = eq([Tag.Seq, [[Tag.Lit, 1], [Tag.Lit, 2]]], [Tag.Seq, [[Tag.Lit, 1], [Tag.Lit, 2]]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})

			it('should unify sequences of variables', () => {
				const goal = eq([Tag.Seq, [[Tag.Var, 'x'], [Tag.Var, 'y']]], [Tag.Seq, [[Tag.Var, 'x'], [Tag.Var, 'y']]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})
			
			it('should unify sequences of variables with literals', () => {
				const goal = eq([Tag.Seq, [[Tag.Var, 'x'], [Tag.Var, 'y']]], [Tag.Seq, [[Tag.Lit, 1], [Tag.Lit, 2]]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map([['x', [Tag.Lit, 1]], ['y', [Tag.Lit, 2]]]), free: 0 }])
			})

			it('should unify sequences of variables with literals (2)', () => {
				const goal = eq([Tag.Seq, [[Tag.Lit, 1], [Tag.Lit, 2]]], [Tag.Seq, [[Tag.Var, 'x'], [Tag.Var, 'y']]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map([['x', [Tag.Lit, 1]], ['y', [Tag.Lit, 2]]]), free: 0 }])
			})

			it('should unify sequences of variables with literals (3)', () => {
				const goal = eq([Tag.Seq, [[Tag.Var, 'x'], [Tag.Var, 'y']]], [Tag.Seq, [[Tag.Lit, 1], [Tag.Var, 'y']]])
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

			it('should unify nil with empty sequence', () => {
				const goal = eq([Tag.Nil], [Tag.Seq, []])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})
			
			it('should not unify nil with non-empty sequence', () => {
				const goal = eq([Tag.Nil], [Tag.Seq, [[Tag.Lit, 1]]])
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

			it('should fail to unify cons with empty seq', () => {
				const goal = eq([Tag.Cons, [Tag.Lit, 1], [Tag.Nil]], [Tag.Seq, []])
				const states = run(10, goal)
				expect(states).toEqual([])
			})

			it('should unify cons with seq length 1', () => {
				const goal = eq([Tag.Cons, [Tag.Lit, 1], [Tag.Nil]], [Tag.Seq, [[Tag.Lit, 1]]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})

			it('should unify cons with seq length 2', () => {
				const goal = eq([Tag.Cons, [Tag.Lit, 1], [Tag.Cons, [Tag.Lit, 2], [Tag.Nil]]], [Tag.Seq, [[Tag.Lit, 1], [Tag.Lit, 2]]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})

			it('should fail to unify with nil', () => {
				const goal = eq([Tag.Cons, [Tag.Lit, 1], [Tag.Nil]], [Tag.Nil])
				const states = run(10, goal)
				expect(states).toEqual([])
			})
		})

		describe('Snoc', () => {
			it('should unify snoc', () => {
				const goal = eq([Tag.Snoc, [Tag.Nil], [Tag.Lit, 1]], [Tag.Snoc, [Tag.Nil], [Tag.Lit, 1]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})

			it('should unify snoc with literals and variables', () => {
				const goal = eq([Tag.Snoc, [Tag.Var, 'x'], [Tag.Var, 'y']], [Tag.Snoc, [Tag.Lit, 1], [Tag.Lit, 2]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map([['x', [Tag.Lit, 1]], ['y', [Tag.Lit, 2]]]), free: 0 }])
			})
			
			it('should unify snoc with three terms', () => {
				const goal = eq([Tag.Snoc, [Tag.Var, 'xs'], [Tag.Var, 'x']], [Tag.Seq, [[Tag.Lit, 1], [Tag.Lit, 2], [Tag.Lit, 3]]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map([['xs', [Tag.Seq, [[Tag.Lit, 1], [Tag.Lit, 2]]]], ['x', [Tag.Lit, 3]]]), free: 0 }])
			})

			it('should fail to unify snoc with empty seq', () => {
				const goal = eq([Tag.Snoc, [Tag.Nil], [Tag.Lit, 1]], [Tag.Seq, []])
				const states = run(10, goal)
				expect(states).toEqual([])
			})

			it('should fail to unify snoc with nil', () => {
				const goal = eq([Tag.Snoc, [Tag.Nil], [Tag.Lit, 1]], [Tag.Nil])
				const states = run(10, goal)
				expect(states).toEqual([])
			})

			it('should unify snoc with seq length 1', () => {
				const goal = eq([Tag.Snoc, [Tag.Nil], [Tag.Lit, 1]], [Tag.Seq, [[Tag.Lit, 1]]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})
		})

		describe('Sets', () => {
			it('should unify sets of constants', () => {
				const goal = eq([Tag.Set, [[Tag.Lit, 1], [Tag.Lit, 2]]], [Tag.Set, [[Tag.Lit, 1], [Tag.Lit, 2]]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }])
			})

			it('should unify sets of variables', () => {
				const goal = eq([Tag.Set, [[Tag.Var, 'x'], [Tag.Var, 'y']]], [Tag.Set, [[Tag.Var, 'x'], [Tag.Var, 'y']]])
				const states = run(10, goal)
				expect(states).toEqual([{ env: new Map(), free: 0 }, { env: new Map([['x', [Tag.Var, 'y']]]), free: 0 }])
			})

			it('should unify sets of variables with literals', () => {
				const goal = eq([Tag.Set, [[Tag.Var, 'x'], [Tag.Var, 'y']]], [Tag.Set, [[Tag.Lit, 1], [Tag.Lit, 2]]])
				const states = run(10, goal)
				expect(states).toEqual([
					{ env: new Map([['x', [Tag.Lit, 1]], ['y', [Tag.Lit, 2]]]), free: 0 },
					{ env: new Map([['x', [Tag.Lit, 2]], ['y', [Tag.Lit, 1]]]), free: 0 },
				])
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
