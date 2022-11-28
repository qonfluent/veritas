import { ArgType, InstructionSetDesc } from '../src/InstructionSet'
import { decodeInstruction, encodeInstruction, Instruction } from '../src/Instruction'

describe('Scratchpad', () => {
	it('Works', () => {
		const desc: InstructionSetDesc = {
			shiftBits: 4,
			argTypeSizes: {
				[ArgType.Reg]: 4,
			},
			formats: [
				{
					countBits: 0,
					decoder: { opcode: 0 },
					ops: [
						{
							argTypes: [ArgType.Reg, ArgType.Reg],
						},
					],
				}
			],
		}

		const ins: Instruction = {
			formats: [
				{
					ops: [
						{
							opcode: 0,
							args: [
								{ type: ArgType.Reg, value: 2 },
								{ type: ArgType.Reg, value: 4 },
							],
						},
					],
				},
			],
		}

		const result0 = encodeInstruction(ins, desc)
		console.log(result0)

		const result1 = decodeInstruction(result0, desc)
		console.log(JSON.stringify(result1))
	})
})
