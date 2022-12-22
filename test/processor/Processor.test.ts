import { Module, moduleToVerilog, Stmt } from "../../src/hdl/Verilog"
import { rangeFlatMap } from "../../src/Util"

export type CacheDesc = {
	addressBits: number
	shiftBits: number
	selectorBits: number
	dataBits: number
	ways: number

	readPorts: number
	writePorts: number

	tristateWriteBus: boolean
}

export function cacheSizeBits(desc: CacheDesc): number {
	const dataSize = desc.dataBits * 8
	const rowCount = 2 ** desc.selectorBits

	return desc.ways * dataSize * rowCount
}

export function createCache(desc: CacheDesc): Module {
	return {
		name: 'cache',
		body: [
			// Clock and reset
			{ signal: 'clk', width: 1, direction: 'input', type: 'wire' },
			{ signal: 'rst', width: 1, direction: 'input', type: 'wire' },

			// Read ports
			...rangeFlatMap<Stmt>(desc.readPorts, (portIndex) => [
				{ signal: `read_${portIndex}`, width: 1, direction: 'input' },
				{ signal: `read_${portIndex}_address`, width: desc.addressBits, direction: 'input' },

				{ signal: `read_${portIndex}_complete`, width: 1, direction: 'output' },
				{ signal: `read_${portIndex}_hit`, width: 1, direction: 'output' },
				{ signal: `read_${portIndex}_data`, width: desc.dataBits, direction: 'input' },
			]),

			// Write ports
			...rangeFlatMap<Stmt>(desc.writePorts, (portIndex) => [
				{ signal: `write_${portIndex}`, width: 1, direction: 'input' },
				{ signal: `write_${portIndex}_address`, width: desc.addressBits, direction: 'input' },
				{ signal: `write_${portIndex}_data`, width: desc.dataBits, direction: 'input' },

				{ signal: `write_${portIndex}_complete`, width: 1, direction: 'output' },
				{ signal: `write_${portIndex}_evict`, width: 1, direction: 'output' },
				...(desc.tristateWriteBus ? [
					{ signal: `write_${portIndex}_evict_address`, width: 1, direction: 'output' },
					{ signal: `write_${portIndex}_evict_data`, width: 1, direction: 'output' },
				] : []) as Stmt[],
			]),
		],
	}
}

describe('Processor', () => {
	it('Can create cache', () => {
		const test = createCache({
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
})
