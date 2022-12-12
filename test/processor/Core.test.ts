import { CacheOp } from "../../src/processor/Cache"
import { CoreDesc, CoreUnit } from "../../src/processor/Core"
import { Instruction } from "../../src/processor/Decoder"
import { MergeTag } from "../../src/processor/Distributor"
import { Encoder } from "../../src/processor/Encoder"
import { ArgMode } from "../../src/processor/Operation"

describe('Core', () => {
	it('Works', () => {
		const cacheWidthBytes = 64

		const desc: CoreDesc = {
			modeSizes: {
				[ArgMode.Reg]: 4,
			},
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
						groups: [
							{
								lanes: 1,
								// TODO: Merge the unit map here, so all the unit descs are in one place
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
			},
			distributor: {
				stallAll: false,
				units: [
					{
						op: {
							argTypes: [],
							resultTypes: [],
							startLatency: 1,
							finishLatency: 1,
							body: () => [],
						},
						merge: {
							tag: MergeTag.Error,
						},
					}
				],
				unitMap: [
					{ groups: [{ lanes: [{ ops: [0] }] }] },
				],
				regMap: [],
			},
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

		const encoder = new Encoder(desc.decoders[0].decoder, desc.modeSizes)
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
