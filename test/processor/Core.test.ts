import { CacheOp } from "../../src/processor/Cache"
import { CoreDesc, CoreUnit } from "../../src/processor/Core"
import { Instruction } from "../../src/processor/Decoder"
import { Encoder } from "../../src/processor/Encoder"
import { ArgMode } from "../../src/processor/Operation"

describe('Core', () => {
	it('Works', () => {
		const cacheWidthBytes = 64

		const desc: CoreDesc = {
			decoders: [
				{
					icache: {
						widthBits: cacheWidthBytes * 8,
						rowCount: 256,
						ways: 4,
						latency: 0,
					},
					decoder: {
						shiftBits: 4,
						modeSizes: {
							[ArgMode.Reg]: 4,
						},
						groups: [
							{
								lanes: 1,
								ops: [
									{
										argTypes: [],
										resultTypes: [],
										startLatency: 1,
										finishLatency: 1,
										body: () => [],
									}
								]
							}
						]
					}
				}
			],
			l2cache: {
				widthBits: cacheWidthBytes * 8,
				rowCount: 2048,
				ways: 16,
				latency: 0,
			}
		}

		const instruction: Instruction = {
			groups: [
				{
					ops: [
						{
							opcode: 0,
							args: [],
						},
					],
				},
			],
		}

		const core = new CoreUnit(desc)

		const encoder = new Encoder(desc.decoders[0].decoder)
		const encIns = encoder.encodeInstruction(instruction)
		const data = new Uint8Array([...encIns, ...[...Array(cacheWidthBytes - encIns.length)].map(() => 0)])

		const initStep = core.step({ cacheWrite: { op: CacheOp.Write, address: 0, data }})
		expect(initStep).toEqual({ l3Cache: undefined })

		for (let i = 0; i < cacheWidthBytes / encIns.length; i++) {
			const step = core.step()
			expect(step).toEqual({ l3Cache: undefined })
		}

		console.log(core.info.decoders[0].ip)
		const step = core.step()
		expect(step).toEqual({ l3Cache: undefined })
	})
})
