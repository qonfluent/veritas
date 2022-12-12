import { CacheOp } from "../../src/processor/Cache"
import { Instruction } from "../../src/processor/Decoder"
import { DecoderBlockDesc, DecoderBlockUnit } from "../../src/processor/DecoderBlock"
import { Encoder } from "../../src/processor/Encoder"
import { ModeSizeMap, ArgMode, OperationDesc } from "../../src/processor/Operation"

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
				groups: [
					{
						lanes: 1,
						ops,
					}
				],
			},
		}

		const decoderBlock = new DecoderBlockUnit(blockDesc, modeSizes)

		// Perform init step
		const initStep = decoderBlock.step()
		expect(initStep).toEqual({ cacheEvict: undefined, cacheMiss: { op: CacheOp.Read, address: 0, widthBytes: cacheWidthBytes } })
		
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
			cacheWrite: {
				op: CacheOp.Write,
				address: 0,
				data,
			}
		})

		expect(fillStep).toEqual({ cacheEvict: undefined, cacheMiss: undefined, decoded: instruction })
		expect(decoderBlock.ip).toBe(encIns.length)
	})
})
