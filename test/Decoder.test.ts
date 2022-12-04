import { DecoderUnit, Instruction, InstructionSetDesc } from '../src/Decoder'
import { Encoder } from '../src/Encoder'
import { DecoderTree } from '../src/DecoderTree'
import { ArgMode, ArgType, ModeSizeMap, OperationDesc } from '../src/Operation'
import { DataTag } from '../src/Types'

describe('Decoder', () => {
	it('Can decode simple entry', () => {
		const modeSizes: ModeSizeMap = {
			[ArgMode.Reg]: 4,
		}

		const entries: OperationDesc[] = [
			{
				argTypes: [],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			}
		]

		const decoder = new DecoderUnit({
			shiftBits: 4,
			modeSizes,
			groups: [
				{
					lanes: 1,
					ops: entries,
				}
			],
		})

		const result = decoder.step({ instruction: new Uint8Array([0]) })
		expect(result).toEqual({ shift: 1, decoded: { groups: [{ ops: [{ opcode: 0, args: [] }] }] } })
	})

	it('Can decode more complex entry', () => {
		const modeSizes: ModeSizeMap = {
			[ArgMode.Reg]: 4,
		}

		const entries: OperationDesc[] = [
			{
				argTypes: [],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
			{
				argTypes: [],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
			{
				argTypes: [],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
			{
				argTypes: [],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
		]

		const decoder = new DecoderUnit({
			shiftBits: 4,
			modeSizes,
			groups: [
				{
					lanes: 1,
					ops: entries,
				}
			],
		})

		const result = decoder.step({ instruction: new Uint8Array([0x00]) })
		expect(result).toEqual({ shift: 1, decoded: { groups: [{ ops: [{ opcode: 0, args: [] }] }] } })
	})

	it('Can encode and decode', () => {
		const modeSizes: ModeSizeMap = {
			[ArgMode.Reg]: 4,
		}

		const intType: ArgType = {
			mode: ArgMode.Reg,
			type: { tag: DataTag.Int, signed: false, width: 32 },
		}

		const entries: OperationDesc[] = [
			{
				argTypes: [intType],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
			{
				argTypes: [intType, intType, intType],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
			{
				argTypes: [intType, intType, intType],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
		]

		const desc: InstructionSetDesc = {
			shiftBits: 4,
			modeSizes,
			groups: [
				{
					lanes: 4,
					ops: entries,
				}
			],
		}

		const testIns: Instruction = {
			groups: [
				{
					ops: [
						{ opcode: 1, args: [{ mode: ArgMode.Reg, index: 0 }, { mode: ArgMode.Reg, index: 5 }, { mode: ArgMode.Reg, index: 6 }] },
						{ opcode: 0, args: [{ mode: ArgMode.Reg, index: 1 }] },
					],
				},
			],
		}

		const testIns2: Instruction = {
			groups: [
				{
					ops: [
						{ opcode: 2, args: [{ mode: ArgMode.Reg, index: 0 }, { mode: ArgMode.Reg, index: 5 }, { mode: ArgMode.Reg, index: 6 }] },
						{ opcode: 0, args: [{ mode: ArgMode.Reg, index: 1 }] },
					],
				},
			],
		}

		const encoder = new Encoder(desc)
		const decoder = new DecoderUnit(desc)

		expect(encoder.encodeInstruction(testIns)).not.toEqual(encoder.encodeInstruction(testIns2))

		const expectedLength = encoder.getInstructionBytes(testIns)
		const encoded = encoder.encodeInstruction(testIns)
		expect(encoded.byteLength).toBe(expectedLength)

		const decoded = decoder.step({ instruction: encoded })
		expect(decoded).toEqual({ shift: expectedLength, decoded: testIns })
	})
})
