import { getInvalidCount, validate } from "../src/assembler/Validator"
import { Instruction } from "../src/common/Assembly"
import { DecoderDesc, RegisterFileDesc } from "../src/common/Processor"

describe('Assembly', () => {
	it('Counts number of invalid instructions', () => {
		const target: DecoderDesc = {
			name: 'test',
			invalidHandler: 'invalid',
			groups: [
				{
					fields: [
						{
							name: 'test',
							type: 'immediate',
							dir: 'input',
							width: 4,
							maxValue: 10,
						},
						{
							name: 'test2',
							type: 'register',
							dir: 'input',
							registerFile: 'regs',
						},
					]
				},
			]
		}

		const registerFiles: RegisterFileDesc[] = [
			{
				name: 'regs',
				uniform: true,
				type: 'index',
				widthBytes: 8,
				count: 12,
			}
		]

		const invalidEntries = getInvalidCount(target, registerFiles)

		expect(invalidEntries).toBe(24)
	})

	it('Validates extra args', () => {
		const target: DecoderDesc = {
			name: 'test',
			extraSignals: 10,
			groups: [
				{
					fields: [
						{
							name: 'test',
							type: 'immediate',
							dir: 'input',
							width: 4,
							maxValue: 10,
						},
					]
				},
			]
		}

		const instruction: Instruction = {
			extra: [10, 0n],
			groups: [
				{
					fields: {
						test: 4,
					}
				}
			]
		}

		validate([instruction], target, [])
	})

	it('Validates extra args fail on invalid', () => {
		const target: DecoderDesc = {
			name: 'test',
			extraSignals: 10,
			groups: [
				{
					fields: [
						{
							name: 'test',
							type: 'immediate',
							dir: 'input',
							width: 4,
							maxValue: 10,
						},
					]
				},
			]
		}

		const instruction: Instruction = {
			groups: [
				{
					fields: {
						test: 4,
					}
				}
			]
		}

		expect(() => validate([instruction], target, [])).toThrow()
	})
})
