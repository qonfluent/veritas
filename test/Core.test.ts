import { show } from "../src/core/AST"
import { unify, run, eq, conj, disj } from "../src/core/Goals"
import { empty, singleton, merge, bind, take } from "../src/core/Stream"

describe('Core', () => {
	describe('Show', () => {
		it('should show a constant', () => {
			expect(show({ tag: 'const', const: 1 })).toEqual('1')
		})

		it('should show a variable', () => {
			expect(show({ tag: 'var', var: 'x' })).toEqual('x')
		})

		it('should show a sequence', () => {
			expect(show({ tag: 'seq', seq: [{ tag: 'const', const: 1 }, { tag: 'const', const: 2 }] })).toEqual('[1, 2]')
		})

		it('should show a set', () => {
			expect(show({ tag: 'set', set: [{ tag: 'const', const: 1 }, { tag: 'const', const: 2 }] })).toEqual('{1, 2}')
		})
	})

	describe('Streams', () => {
		it('Should generate an empty stream', () => {
			const stream = empty<number>()
			expect(stream.head).toEqual([])
			expect(stream.tail).toBeUndefined()
		})

		it('Should generate a singleton stream', () => {
			const stream = singleton(1)
			expect(stream.head).toEqual([1])
			expect(stream.tail).toBeUndefined()
		})

		it('Should merge two streams', () => {
			const stream = merge(singleton(1), singleton(2))
			expect(stream.head).toEqual([1, 2])
			expect(stream.tail).toBeUndefined()
		})

		it('Should bind a stream', () => {
			const stream = bind(singleton(1), (a) => singleton(a + 1))
			expect(stream.head).toEqual([2])
			expect(stream.tail).toBeUndefined()
		})
	})

	describe('Unify', () => {
		it('should unify two constants', () => {
			const result = unify({ tag: 'const', const: 1 }, { tag: 'const', const: 1 }, [])
			expect(result.head).toEqual([[]])
		})

		describe('Variables', () => {
			it('should unify two variables', () => {
				const result = unify({ tag: 'var', var: 'x' }, { tag: 'var', var: 'y' }, [])
				expect(result.head).toEqual([[{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'var', var: 'y' } }]])
			})

			it('should unify a constant and a variable', () => {
				const result = unify({ tag: 'const', const: 1 }, { tag: 'var', var: 'x' }, [])
				expect(result.head).toEqual([[{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 1 } }]])
			})

			it('should unify a variable and a constant', () => {
				const result = unify({ tag: 'var', var: 'x' }, { tag: 'const', const: 1 }, [])
				expect(result.head).toEqual([[{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 1 } }]])
			})
		})

		describe('Sequences', () => {
			describe('Seq', () => {
				it('should unify a sequence of constants', () => {
					const result = unify({ tag: 'seq', seq: [{ tag: 'const', const: 1 }, { tag: 'const', const: 2 }] }, { tag: 'seq', seq: [{ tag: 'const', const: 1 }, { tag: 'const', const: 2 }] }, [])
					expect(result.head).toEqual([[]])
				})

				it('should unify a sequence of variables', () => {
					const result = unify({ tag: 'seq', seq: [{ tag: 'var', var: 'x' }, { tag: 'var', var: 'y' }] }, { tag: 'seq', seq: [{ tag: 'var', var: 'z' }, { tag: 'var', var: 'w' }] }, [])
					expect(result.head).toEqual([[{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'var', var: 'z' } }, { tag: 'eq', lhs: { tag: 'var', var: 'y' }, rhs: { tag: 'var', var: 'w' } }]])
				})

				it('should unify a sequence of constants and variables', () => {
					const result = unify({ tag: 'seq', seq: [{ tag: 'const', const: 1 }, { tag: 'var', var: 'x' }] }, { tag: 'seq', seq: [{ tag: 'var', var: 'y' }, { tag: 'const', const: 2 }] }, [])
					expect(result.head).toEqual([[{ tag: 'eq', lhs: { tag: 'var', var: 'y' }, rhs: { tag: 'const', const: 1 } }, { tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 2 } }]])
				})
			})

			describe('Nil', () => {
				it('Should unify nil', () => {
					const result = unify({ tag: 'nil' }, { tag: 'nil' }, [])
					expect(result.head).toEqual([[]])
				})

				it('Should fail to unify nil and a cons', () => {
					const result = unify({ tag: 'nil' }, { tag: 'cons', head: { tag: 'const', const: 1 }, tail: { tag: 'nil' } }, [])
					expect(result.head).toEqual([])
				})

				it('Should fail to unify a cons and nil', () => {
					const result = unify({ tag: 'cons', head: { tag: 'const', const: 1 }, tail: { tag: 'nil' } }, { tag: 'nil' }, [])
					expect(result.head).toEqual([])
				})

				it('Should fail to unify a sequence and nil', () => {
					const result = unify({ tag: 'seq', seq: [{ tag: 'const', const: 1 }] }, { tag: 'nil' }, [])
					expect(result.head).toEqual([])
				})

				it('Should fail to unify nil and a sequence', () => {
					const result = unify({ tag: 'nil' }, { tag: 'seq', seq: [{ tag: 'const', const: 1 }] }, [])
					expect(result.head).toEqual([])
				})

				it('Should unify an empty sequence and nil', () => {
					const result = unify({ tag: 'seq', seq: [] }, { tag: 'nil' }, [])
					expect(result.head).toEqual([[]])
				})
			})

			describe('Cons', () => {
				it('Should unify a sequence and a cons', () => {
					const result = unify({ tag: 'seq', seq: [{ tag: 'const', const: 1 }] }, { tag: 'cons', head: { tag: 'const', const: 1 }, tail: { tag: 'nil' } }, [])
					expect(result.head).toEqual([[]])
				})

				it('Should unify a cons and a sequence', () => {
					const result = unify({ tag: 'cons', head: { tag: 'const', const: 1 }, tail: { tag: 'nil' } }, { tag: 'seq', seq: [{ tag: 'const', const: 1 }] }, [])
					expect(result.head).toEqual([[]])
				})

				it('Should unify a sequence and a cons with a variable', () => {
					const result = unify({ tag: 'seq', seq: [{ tag: 'const', const: 1 }] }, { tag: 'cons', head: { tag: 'var', var: 'x' }, tail: { tag: 'nil' } }, [])
					expect(result.head).toEqual([[{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 1 } }]])
				})

				it('Should fail to unify a sequence and a cons with a different constant', () => {
					const result = unify({ tag: 'seq', seq: [{ tag: 'const', const: 1 }] }, { tag: 'cons', head: { tag: 'const', const: 2 }, tail: { tag: 'nil' } }, [])
					expect(result.head).toEqual([])
				})

				it('Should unify a cons with a cons', () => {
					const result = unify({ tag: 'cons', head: { tag: 'const', const: 1 }, tail: { tag: 'nil' } }, { tag: 'cons', head: { tag: 'const', const: 1 }, tail: { tag: 'nil' } }, [])
					expect(result.head).toEqual([[]])
				})

				it('Should unify a cons with a cons with a variable', () => {
					const result = unify({ tag: 'cons', head: { tag: 'var', var: 'x' }, tail: { tag: 'nil' } }, { tag: 'cons', head: { tag: 'const', const: 1 }, tail: { tag: 'nil' } }, [])
					expect(result.head).toEqual([[{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 1 } }]])
				})
			})
		})

		describe('Sets', () => {
			it('should unify a set of constants', () => {
				const result = unify({ tag: 'set', set: [{ tag: 'const', const: 1 }, { tag: 'const', const: 2 }] }, { tag: 'set', set: [{ tag: 'const', const: 1 }, { tag: 'const', const: 2 }] }, [])
				expect(result.head).toEqual([[]])
			})

			it('should unify a set of constants in a different order', () => {
				const result = unify({ tag: 'set', set: [{ tag: 'const', const: 1 }, { tag: 'const', const: 2 }] }, { tag: 'set', set: [{ tag: 'const', const: 2 }, { tag: 'const', const: 1 }] }, [])
				expect(result.head).toEqual([[]])
			})

			it('should unify a set of variables', () => {
				const result = unify({ tag: 'set', set: [{ tag: 'var', var: 'x' }, { tag: 'var', var: 'y' }] }, { tag: 'set', set: [{ tag: 'var', var: 'z' }, { tag: 'var', var: 'w' }] }, [])
				expect(result.head).toEqual([
					[{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'var', var: 'z' } }, { tag: 'eq', lhs: { tag: 'var', var: 'y' }, rhs: { tag: 'var', var: 'w' } }],
					[{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'var', var: 'w' } }, { tag: 'eq', lhs: { tag: 'var', var: 'y' }, rhs: { tag: 'var', var: 'z' } }],
				])
			})

			it('should unify a set of constants and variables', () => {
				const result = unify({ tag: 'set', set: [{ tag: 'const', const: 1 }, { tag: 'var', var: 'x' }] }, { tag: 'set', set: [{ tag: 'var', var: 'y' }, { tag: 'const', const: 2 }] }, [])
				expect(result.head).toEqual([[{ tag: 'eq', lhs: { tag: 'var', var: 'y' }, rhs: { tag: 'const', const: 1 } }, { tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 2 } }]])
			})
		})
	})

	describe('Goals', () => {
		describe('Equality', () => {
			it('should solve equality goal', () => {
				const result = take(1, run(eq({ tag: 'const', const: 1 }, { tag: 'const', const: 1 })))
				expect(result[0].constraints).toEqual([])
			})

			it('should solve equality goal with variables', () => {
				const result = take(1, run(eq({ tag: 'var', var: 'x' }, { tag: 'var', var: 'y' })))
				expect(result[0].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'var', var: 'y' } }])
			})

			it('should solve equality goal with variables and constants', () => {
				const result = take(1, run(eq({ tag: 'var', var: 'x' }, { tag: 'const', const: 1 })))
				expect(result[0].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 1 } }])
			})

			it('should solve equality goal with variables and constants in different order', () => {
				const result = take(1, run(eq({ tag: 'const', const: 1 }, { tag: 'var', var: 'x' })))
				expect(result[0].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 1 } }])
			})

			it('should solve equality goal with a sequence of constants', () => {
				const result = take(1, run(eq({ tag: 'seq', seq: [{ tag: 'const', const: 1 }, { tag: 'const', const: 2 }] }, { tag: 'seq', seq: [{ tag: 'const', const: 1 }, { tag: 'const', const: 2 }] })))
				expect(result[0].constraints).toEqual([])
			})

			it('should solve equality goal with a sequence of constants and variables', () => {
				const result = take(1, run(eq({ tag: 'seq', seq: [{ tag: 'const', const: 1 }, { tag: 'var', var: 'x' }] }, { tag: 'seq', seq: [{ tag: 'var', var: 'y' }, { tag: 'const', const: 2 }] })))
				expect(result[0].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: 'y' }, rhs: { tag: 'const', const: 1 } }, { tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 2 } }])
			})

			it('should solve equality goal with a set of constants', () => {
				const result = take(1, run(eq({ tag: 'set', set: [{ tag: 'const', const: 1 }, { tag: 'const', const: 2 }] }, { tag: 'set', set: [{ tag: 'const', const: 1 }, { tag: 'const', const: 2 }] })))
				expect(result[0].constraints).toEqual([])
			})

			it('should solve equality goal with a set of constants and variables', () => {
				const result = take(1, run(eq({ tag: 'set', set: [{ tag: 'const', const: 1 }, { tag: 'var', var: 'x' }] }, { tag: 'set', set: [{ tag: 'var', var: 'y' }, { tag: 'const', const: 2 }] })))
				expect(result[0].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: 'y' }, rhs: { tag: 'const', const: 1 } }, { tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 2 } }])
			})

			it('should solve equality goal with a set of constants and variables in different order', () => {
				const result = take(1, run(eq({ tag: 'set', set: [{ tag: 'var', var: 'x' }, { tag: 'const', const: 1 }] }, { tag: 'set', set: [{ tag: 'const', const: 2 }, { tag: 'var', var: 'y' }] })))
				expect(result[0].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 2 } }, { tag: 'eq', lhs: { tag: 'var', var: 'y' }, rhs: { tag: 'const', const: 1 } }])
			})
		})

		describe('Conjunction', () => {
			it('should solve conjunction goal', () => {
				const result = take(1, run(conj(eq({ tag: 'const', const: 1 }, { tag: 'const', const: 1 }), eq({ tag: 'const', const: 2 }, { tag: 'const', const: 2 }))))
				expect(result[0].constraints).toEqual([])
			})

			it('should solve conjunction goal with variables', () => {
				const result = take(1, run(conj(eq<number>({ tag: 'var', var: 'x' }, { tag: 'var', var: 'y' }), eq({ tag: 'var', var: 'y' }, { tag: 'const', const: 1 }))))
				expect(result[0].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'var', var: 'y' } }, { tag: 'eq', lhs: { tag: 'var', var: 'y' }, rhs: { tag: 'const', const: 1 } }])
			})

			it('should solve conjunction goal with variables and constants', () => {
				const result = take(1, run(conj(eq<number>({ tag: 'var', var: 'x' }, { tag: 'const', const: 1 }), eq({ tag: 'var', var: 'y' }, { tag: 'const', const: 2 }))))
				expect(result[0].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 1 } }, { tag: 'eq', lhs: { tag: 'var', var: 'y' }, rhs: { tag: 'const', const: 2 } }])
			})

			it('Should fail conjunction goal when one side fails', () => {
				const result = take(1, run(conj(eq({ tag: 'const', const: 1 }, { tag: 'const', const: 2 }), eq({ tag: 'const', const: 2 }, { tag: 'const', const: 2 }))))
				expect(result).toEqual([])
			})

			it('Should fail conjunction goal when both sides fail', () => {
				const result = take(1, run(conj(eq({ tag: 'const', const: 1 }, { tag: 'const', const: 2 }), eq({ tag: 'const', const: 2 }, { tag: 'const', const: 3 }))))
				expect(result).toEqual([])
			})
		})

		describe('Disjunction', () => {
			it('should solve disjunction goal', () => {
				const result = take(1, run(disj(eq({ tag: 'const', const: 1 }, { tag: 'const', const: 1 }), eq({ tag: 'const', const: 2 }, { tag: 'const', const: 2 }))))
				expect(result[0].constraints).toEqual([])
			})

			it('should solve disjunction goal with variables', () => {
				const result = take(2, run(disj(eq<number>({ tag: 'var', var: 'x' }, { tag: 'var', var: 'y' }), eq({ tag: 'var', var: 'y' }, { tag: 'const', const: 1 }))))
				expect(result[0].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'var', var: 'y' } }])
				expect(result[1].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: 'y' }, rhs: { tag: 'const', const: 1 } }])
			})

			it('should solve disjunction goal with variables and constants', () => {
				const result = take(1, run(disj(eq<number>({ tag: 'var', var: 'x' }, { tag: 'const', const: 1 }), eq({ tag: 'var', var: 'y' }, { tag: 'const', const: 2 }))))
				expect(result[0].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: 'x' }, rhs: { tag: 'const', const: 1 } }])
			})

			it('Should fail disjunction goal when both sides fail', () => {
				const result = take(1, run(disj(eq({ tag: 'const', const: 1 }, { tag: 'const', const: 2 }), eq({ tag: 'const', const: 2 }, { tag: 'const', const: 3 }))))
				expect(result).toEqual([])
			})

			it('Should solve disjunction goal when one side fails', () => {
				const result = take(1, run(disj(eq({ tag: 'const', const: 1 }, { tag: 'const', const: 2 }), eq({ tag: 'const', const: 2 }, { tag: 'const', const: 2 }))))
				expect(result[0].constraints).toEqual([])
			})
		})
	})

	describe('Suspended goals', () => {
		it('Will suspend a goal', () => {
			const result = take(1, run(eq<string | number>({ tag: 'var', var: '@x' }, { tag: 'seq', seq: [{ tag: 'const', const: '*' }, { tag: 'const', const: 2 }, { tag: 'var', var: 'y' }] })))
			expect(result[0].constraints).toEqual([{ tag: 'eq', lhs: { tag: 'var', var: '@x' }, rhs: { tag: 'seq', seq: [{ tag: 'const', const: '*' }, { tag: 'const', const: 2 }, { tag: 'var', var: 'y' }] } }])
		})
	})
})
