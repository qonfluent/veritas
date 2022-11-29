import { BitStream } from '../src/BitStream'
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
					decoder: new DecoderTree(entries, modeSizes),
					ops: entries,
				}
			],
		})

		const result = decoder.step({ instruction: new BitStream(new Uint8Array([0])) })
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
					decoder: new DecoderTree(entries, modeSizes),
					ops: entries,
				}
			],
		})

		const result = decoder.step({ instruction: new BitStream(new Uint8Array([0x20])) })
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
					lanes: 1,
					decoder: new DecoderTree(entries, modeSizes),
					ops: entries,
				}
			],
		}

		const testIns: Instruction = {
			groups: [
				{
					ops: [
						{ opcode: 0, args: [{ mode: ArgMode.Reg, index: 0 }] },
					],
				},
			],
		}

		const encoder = new Encoder(desc)
		const decoder = new DecoderUnit(desc)

		const encoded = encoder.encodeInstruction(testIns)
		const decoded = decoder.step({ instruction: encoded })
		expect(decoded).toEqual({ shift: 3, decoded: testIns })
	})
})
