import { CacheOp } from "../src/Cache"
import { Instruction } from "../src/Decoder"
import { DecoderBlockDesc, DecoderBlockUnit } from "../src/DecoderBlock"
import { DecoderTree } from "../src/DecoderTree"
import { Encoder } from "../src/Encoder"
import { ModeSizeMap, ArgMode, OperationDesc } from "../src/Operation"

describe('DecoderBlock', () => {
	it('Can be created', () => {
		// Construct the decoder block
		const cacheWidthBytes = 64
		const modeSizes: ModeSizeMap = {
			[ArgMode.Reg]: 4,
		}

		const ops: OperationDesc[] = [
			{
				argTypes: [],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			}
		]

		const blockDesc: DecoderBlockDesc = {
			icache: {
				widthBits: cacheWidthBytes * 8,
				rowCount: 1024,
				ways: 3,
				latency: 0,
			},
			decoder: {
				shiftBits: 4,
				modeSizes,
				groups: [
					{
						lanes: 1,
						decoder: new DecoderTree(ops, modeSizes),
						ops,
					}
				],
			},
		}

		const decoderBlock = new DecoderBlockUnit(blockDesc)

		// Perform init step
		const initStep = decoderBlock.step()
		expect(initStep).toEqual({ cacheMiss: { op: CacheOp.Read, address: 0, widthBytes: cacheWidthBytes }})
		
		// Perform cache fill using encoded instruction
		const instruction: Instruction = {
			groups: [
				{
					ops: [
						{
							opcode: 0,
							args: [],
						}
					]
				}
			],
		}

		// Step decoder block
		const encoder = new Encoder(blockDesc.decoder)
		const encIns = encoder.encodeInstruction(instruction)
		const data = new Uint8Array([...encIns, ...[...Array(cacheWidthBytes - encIns.length)].map(() => 0)])
		const fillStep = decoderBlock.step({
			cacheFill: {
				op: CacheOp.Write,
				address: 0,
				data,
			}
		})

		expect(fillStep).toEqual({ cacheWrite: {} })

		const decodeStep = decoderBlock.step()
		expect(decodeStep?.decoded).toEqual(instruction)
		expect(decoderBlock.ip).toBe(encIns.length)
	})
})
