import { moduleToVerilog } from '../../src/hdl/Verilog'
import { createCache } from '../../src/processor/Cache'
import { createCacheController } from '../../src/processor/CacheController'
import { createCore, getOperationArgs, OperationDesc } from '../../src/processor/Core'
import { createDecoder, DecoderDesc } from '../../src/processor/Decoder'
import { createDecoderTree, fillDecoderTree } from '../../src/processor/DecoderTree'
import { rangeMap } from '../../src/Util'
import { randomDecoderDesc } from '../Common'

describe('Processor', () => {
	it('Can create cache', () => {
		const test = createCache('test', {
			addressBits: 32,
			shiftBits: 6,
			selectorBits: 7,
			dataBits: 8 * 64,
			ways: 4,
			readPorts: 2,
			writePorts: [true, false],
		})

		const code = moduleToVerilog(test)
		console.log(code)
	})

	it.only('Can create cache controller', () => {
		const test = createCacheController('test', {
			shiftBits: 6,
			selectorBits: 7,
			bankBits: [6],
			upperBits: 45,
			ways: 8,
			readPorts: [{ retireStations: 2 }, { retireStations: 2 }],
			writePorts: [{ tristate: true }, { tristate: false }],
		})

		const code = moduleToVerilog(test, true)
		console.log(code)
	})

	it('Can create decoder tree', () => {
		const opCount = 16
		const ops = rangeMap(opCount, (i) => ({ opcode: i, args: { a: 4, b: 4 } }))
		const test = createDecoderTree('test', fillDecoderTree({ ops }))

		const code = moduleToVerilog(test)
		console.log(code)
	})

	it('Can create decoder', () => {
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

		const code = moduleToVerilog(test)
		console.log(code)
	})

	it('Can create core', () => {
		const opCount = 16
		const units: OperationDesc[] = rangeMap(opCount, () => ({
			args: {
				a: { type: 'register', encodedBits: 4 },
				b: { type: 'register', encodedBits: 4 },
			},
			body: [],
		}))

		const test = createCore('test', {
			decoders: rangeMap(2, () => ({
				decoder: randomDecoderDesc(3, 4, 16, units.map((u) => getOperationArgs(u))),
				streamBytes: 128,
			})),
			operations: units,
		})

		const code = moduleToVerilog(test, true)
		console.log(code)
	})
})
