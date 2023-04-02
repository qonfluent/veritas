import { Rule, run } from "../src/core/Core"


describe('Core', () => {
	it('Can run the ABC language', () => {
		const rules: Rule[] = [
			{ top: ['a'], bottom: ['b'] },
			{ top: ['b'], bottom: ['c'] },
		]

		const value = 'a'

		const result = run({ rules, value })

		expect(result).toEqual([{
			path: [0, 1],
			rules,
			value: 'c',
		}])
	})

	it('Can rn the if/then language', () => {
		const rules: Rule[] = [
			{ top: [['if', 'true', 'then', 0, 'else', 1]], bottom: [0] },
			{ top: [['if', 'false', 'then', 0, 'else', 1]], bottom: [1] },
		]

		const value = ['if', 'true', 'then', 'a', 'else', 'b']

		const result = run({ rules, value })

		expect(result).toEqual([{
			path: [0],
			rules,
			value: 'a',
		}])

		const value2 = ['if', 'false', 'then', 'a', 'else', 'b']

		const result2 = run({ rules, value: value2 })

		expect(result2).toEqual([{
			path: [1],
			rules,
			value: 'b',
		}])
	})

	it('Can run peano arithmetic', () => {
		const rules: Rule[] = [
			{ top: [['+', 'Z', 0]], bottom: [0] },
			{ top: [['+', ['S', 0], 1]], bottom: [['S', ['+', 0, 1]]] },
		]

		const value = ['+', ['S', ['S', 'Z']], ['S', ['S', 'Z']]]
		const result = run({ rules, value })
		expect(result).toEqual([{
			path: [1, 1, 0],
			rules,
			value: ['S', ['S', ['S', ['S', 'Z']]]],
		}])
	})
})
