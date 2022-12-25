import { moduleToVerilog } from "../../src/hdl/Verilog"
import { createCache } from "../../src/processor/Cache"
import { createDecoder } from "../../src/processor/Decoder"
import { createDecoderTree, fillDecoderTree } from "../../src/processor/DecoderTree"
import { rangeMap } from "../../src/Util"

describe('Processor', () => {
	it('Can create cache', () => {
		const test = createCache('test', {
			addressBits: 32,
			shiftBits: 6,
			selectorBits: 7,
			dataBits: 8 * 64,
			ways: 4,
			readPorts: 2,
			writePorts: 2,
			tristateWriteBus: true,
		})

		const code = moduleToVerilog(test)
		console.log(code)
	})

	it('Can create decoder tree', () => {
		const opCount = 16
		const ops = rangeMap(opCount, () => 8)
		const test = createDecoderTree('test', fillDecoderTree({ argBits: ops }))

		const code = moduleToVerilog(test)
		console.log(code)
	})

	it.only('Can create decoder', () => {
		const opCount = 16
		const ops = rangeMap(opCount, (i) => i)
		const units = rangeMap(opCount, () => ({ args: { a: 4, b: 4 } }))

		const test = createDecoder('test', {
			groups: [
				[ops, ops],
				[ops, ops],
				[ops, ops, ops],
				[ops, ops, ops, ops],
			]
		}, units)

		const code = moduleToVerilog(test, true)
		console.log(code)
	})
})
