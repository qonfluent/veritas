import { Rule, run } from "../src/core/Core"

describe('Core', () => {
	it('Can run the ABC language', () => {
		const rules: Rule[] = [
			{ top: ['a'], bottom: ['b'] },
			{ top: ['b'], bottom: ['c'] },
		]

		const program = 'a'

		const result = run(rules, program)

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

		const program = ['if', 'true', 'then', 'a', 'else', 'b']

		const result = run(rules, program)

		expect(result).toEqual([{
			path: [0],
			rules,
			value: 'a',
		}])

		const program2 = ['if', 'false', 'then', 'a', 'else', 'b']

		const result2 = run(rules, program2)

		expect(result2).toEqual([{
			path: [1],
			rules,
			value: 'b',
		}])
	})
})
