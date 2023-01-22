import { getInvalidCount } from "../src/assembler/Validator"
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
							maxValue: 10
						},
						{
							name: 'test2',
							type: 'register',
							dir: 'input',
							registerFile: 'regs',
						}
					]
				}
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
})
