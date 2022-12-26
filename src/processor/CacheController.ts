import { Module } from '../hdl/Verilog'
import { recordRangeFlatMap } from '../Util'
import { createCache } from './Cache'

export type CacheControllerDesc = {
	shiftBits: number
	selectorBits: number
	bankBits: number[]
	upperBits: number
	ways: number

	readPorts: number
	writePorts: boolean[]
}

export function createCacheController(name: string, desc: CacheControllerDesc): Module {
	const totalBankBits = desc.bankBits.reduce((a, b) => a + b, 0)
	const bankCount = Math.pow(2, totalBankBits)

	const unbankedAddressWidth = desc.shiftBits + desc.selectorBits + desc.upperBits
	const fullAddressWidth = unbankedAddressWidth + totalBankBits
	const dataWidth = 9 * Math.pow(2, desc.shiftBits)

	const cache = createCache(`${name}_cache`, {
		addressBits: unbankedAddressWidth,
		shiftBits: desc.shiftBits,
		selectorBits: desc.selectorBits,
		dataBits: dataWidth,
		ways: desc.ways,
		readPorts: desc.readPorts,
		writePorts: desc.writePorts,
	})

	return {
		name,
		body: [
			{ signal: 'clk', width: 1, direction: 'input' },
			{ signal: 'rst', width: 1, direction: 'input' },

			// Create internal signal arrays for banks
			{ signal: 'read_enables', width: bankCount, depth: [desc.readPorts] },
			{ signal: 'read_addresses', width: unbankedAddressWidth, depth: [desc.readPorts] },
			{ signal: 'read_completes', width: desc.readPorts },
			{ signal: 'read_hits', width: desc.readPorts },
			{ signal: 'read_data', width: dataWidth, depth: [desc.readPorts] },

			{ signal: 'write_enables', width: bankCount, depth: [desc.writePorts.length] },
			{ signal: 'write_valids', width: desc.writePorts.length },
			{ signal: 'write_addresses', width: unbankedAddressWidth, depth: [desc.writePorts.length] },
			{ signal: 'write_completes', width: desc.writePorts.length },
			{ signal: 'write_data', width: dataWidth, depth: [desc.writePorts.length] },
			{ signal: 'write_evicts', width: desc.writePorts.length },
			{ signal: 'write_evict_addresses', width: unbankedAddressWidth, depth: [desc.writePorts.length] },
			{ signal: 'write_evict_data', width: dataWidth, depth: [desc.writePorts.length] },
			
			// Create cache array
			{
				instance: 'cache',
				module: cache,
				count: bankCount,
				ports: {
					clk: 'clk',
					rst: 'rst',

					...recordRangeFlatMap(desc.readPorts, (portIndex) => [
						[`read_${portIndex}`, { index: 'read_enables', start: portIndex }],
						[`read_${portIndex}_address`, { index: 'read_addresses', start: portIndex }],
						[`read_${portIndex}_complete`, { index: 'read_completes', start: portIndex }],
						[`read_${portIndex}_hit`, { index: 'read_hits', start: portIndex }],
						[`read_${portIndex}_data`, { index: 'read_data', start: portIndex }],
					]),

					...Object.fromEntries(desc.writePorts.flatMap((tristate, portIndex) => [
						[`write_${portIndex}`, { index: 'write_enables', start: portIndex }],
						[`write_${portIndex}_valid`, { index: 'write_valids', start: portIndex }],
						[`write_${portIndex}_address`, { index: 'write_addresses', start: portIndex }],
						[`write_${portIndex}_complete`, { index: 'write_completes', start: portIndex }],
						[`write_${portIndex}_data`, { index: 'write_data', start: portIndex }],
						[`write_${portIndex}_evict`, { index: 'write_evicts', start: portIndex }],
						...(tristate ? [] : [
							[`write_${portIndex}_evict_address`, { index: 'write_evict_addresses', start: portIndex }],
							[`write_${portIndex}_evict_data`, { index: 'write_evict_data', start: portIndex }],
						]),
					])),
				}
			}
		],
	}
}
