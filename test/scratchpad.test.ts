import { ArgMode, createDecoder, getEncoderTable, InstructionSetDesc, OpcodeDesc } from '../src/InstructionSet'
import { decodeInstruction, encodeInstruction, Instruction } from '../src/Instruction'
import { DataTypeTag } from '../src/Types'

describe('Scratchpad', () => {
	it('Can encode/decode simple instructions', () => {
		const desc: InstructionSetDesc = {
			shiftBits: 4,
			modeSizes: {
				[ArgMode.Reg]: 4,
			},
			formats: [
				{
					countBits: 0,
					decoder: { opcode: 0 },
					ops: [
						{
							argTypes: [
								{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
								{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
							],
							startLatency: 1,
							finishLatency: 1,
							body: () => [],
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
								{ mode: ArgMode.Reg, value: 2 },
								{ mode: ArgMode.Reg, value: 4 },
							],
						},
					],
				},
			],
		}

		const result0 = encodeInstruction(ins, desc, desc.formats.map((format) => getEncoderTable(format.decoder)))
		const result1 = decodeInstruction(result0, desc)
		expect(result1).toEqual({ instruction: ins, shift: 2 })
	})

	it('Can encode/decode slightly less simple instructions', () => {
		const desc: InstructionSetDesc = {
			shiftBits: 4,
			modeSizes: {
				[ArgMode.Reg]: 4,
			},
			formats: [
				{
					countBits: 1,
					decoder: { zero: { opcode: 0 }, one: { opcode: 1 } },
					ops: [
						{
							argTypes: [
								{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
								{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
							],
							startLatency: 1,
							finishLatency: 1,
							body: () => [],
						},
						{
							argTypes: [
								{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
								{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
							],
							startLatency: 1,
							finishLatency: 1,
							body: () => [],
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
								{ mode: ArgMode.Reg, value: 2 },
								{ mode: ArgMode.Reg, value: 4 },
							],
						},
						{
							opcode: 1,
							args: [
								{ mode: ArgMode.Reg, value: 3 },
								{ mode: ArgMode.Reg, value: 5 },
							],
						},
					],
				},
			],
		}

		const result0 = encodeInstruction(ins, desc, desc.formats.map((format) => getEncoderTable(format.decoder)))
		const result1 = decodeInstruction(result0, desc)
		expect(result1).toEqual({ instruction: ins, shift: 3 })
	})

	it('Can compute decoder value for same size entries', () => {
		{
			const entries: OpcodeDesc[] = [
				{
					argTypes: [
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
					],
					startLatency: 1,
					finishLatency: 1,
					body: () => [],
				},
			]
			const decoder = createDecoder(entries, { [ArgMode.Reg]: 5 })
			expect(decoder).toEqual({ opcode: 0 })
		}

		{
			const entries: OpcodeDesc[] = [
				{
					argTypes: [
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
					],
					startLatency: 1,
					finishLatency: 1,
					body: () => [],
				},
				{
					argTypes: [
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
					],
					startLatency: 1,
					finishLatency: 1,
					body: () => [],
				},
			]
			const decoder = createDecoder(entries, { [ArgMode.Reg]: 5 })
			expect(decoder).toEqual({ zero: { opcode: 0 }, one: { opcode: 1 } })
		}

		{
			const entries: OpcodeDesc[] = [
				{
					argTypes: [
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
					],
					startLatency: 1,
					finishLatency: 1,
					body: () => [],
				},
				{
					argTypes: [
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
					],
					startLatency: 1,
					finishLatency: 1,
					body: () => [],
				},
				{
					argTypes: [
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
						{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
					],
					startLatency: 1,
					finishLatency: 1,
					body: () => [],
				},
			]
			const decoder = createDecoder(entries, { [ArgMode.Reg]: 5 })
			expect(decoder).toEqual({ zero: { zero: { opcode: 0 }, one: { opcode: 1 } }, one: { opcode: 2 } })
		}
	})

	it('Can compute decoder value for different size entries', () => {
		const entries: OpcodeDesc[] = [
			{
				argTypes: [
					{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
					{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
				],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
			{
				argTypes: [
					{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
				],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
			{
				argTypes: [
					{ mode: ArgMode.Reg, type: { tag: DataTypeTag.Int, signed: false, width: 32 } },
				],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
		]
		const decoder = createDecoder(entries, { [ArgMode.Reg]: 5 })
		expect(decoder).toEqual({ zero: { zero: { opcode: 1 }, one: { opcode: 2 } }, one: { opcode: 0 } })
	})
})
