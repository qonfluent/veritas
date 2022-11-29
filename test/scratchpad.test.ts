import { ArgType, createDecoder, getEncoderTable, InstructionSetDesc, OpcodeDesc } from '../src/InstructionSet'
import { decodeInstruction, encodeInstruction, Instruction } from '../src/Instruction'

describe('Scratchpad', () => {
	it('Can encode/decode simple instructions', () => {
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

		const result0 = encodeInstruction(ins, desc, desc.formats.map((format) => getEncoderTable(format.decoder)))
		const result1 = decodeInstruction(result0, desc)
		expect(result1).toEqual(ins)
	})

	it('Can encode/decode slightly less simple instructions', () => {
		const desc: InstructionSetDesc = {
			shiftBits: 4,
			argTypeSizes: {
				[ArgType.Reg]: 4,
			},
			formats: [
				{
					countBits: 1,
					decoder: { zero: { opcode: 0 }, one: { opcode: 1 } },
					ops: [
						{
							argTypes: [ArgType.Reg, ArgType.Reg],
						},
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
						{
							opcode: 1,
							args: [
								{ type: ArgType.Reg, value: 3 },
								{ type: ArgType.Reg, value: 5 },
							],
						},
					],
				},
			],
		}

		const result0 = encodeInstruction(ins, desc, desc.formats.map((format) => getEncoderTable(format.decoder)))
		const result1 = decodeInstruction(result0, desc)
		expect(result1).toEqual(ins)
	})

	it('Can compute decoder value for same size entries', () => {
		{
			const entries: OpcodeDesc[] = [
				{ argTypes: [ArgType.Reg, ArgType.Reg] },
			]
			const decoder = createDecoder(entries, { [ArgType.Reg]: 5 })
			expect(decoder).toEqual({ opcode: 0 })
		}

		{
			const entries: OpcodeDesc[] = [
				{ argTypes: [ArgType.Reg, ArgType.Reg] },
				{ argTypes: [ArgType.Reg, ArgType.Reg] },
			]
			const decoder = createDecoder(entries, { [ArgType.Reg]: 5 })
			expect(decoder).toEqual({ zero: { opcode: 0 }, one: { opcode: 1 } })
		}

		{
			const entries: OpcodeDesc[] = [
				{ argTypes: [ArgType.Reg, ArgType.Reg] },
				{ argTypes: [ArgType.Reg, ArgType.Reg] },
				{ argTypes: [ArgType.Reg, ArgType.Reg] },
			]
			const decoder = createDecoder(entries, { [ArgType.Reg]: 5 })
			expect(decoder).toEqual({ zero: { zero: { opcode: 0 }, one: { opcode: 1 } }, one: { opcode: 2 } })
		}
	})

	it('Can compute decoder value for different size entries', () => {
		const entries: OpcodeDesc[] = [
			{ argTypes: [ArgType.Reg, ArgType.Reg] },
			{ argTypes: [ArgType.Reg] },
			{ argTypes: [ArgType.Reg] },
		]
		const decoder = createDecoder(entries, { [ArgType.Reg]: 5 })
		expect(decoder).toEqual({ zero: { zero: { opcode: 1 }, one: { opcode: 2 } }, one: { opcode: 0 } })
	})
})
