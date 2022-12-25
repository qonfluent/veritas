import { Module } from '../hdl/Verilog'
import { rangeMap } from '../Util'
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
	const cacheModule = createCache(`${name}_cache`, {
		addressBits: desc.shiftBits + desc.selectorBits + desc.upperBits,
		shiftBits: desc.shiftBits,
		selectorBits: desc.selectorBits,
		dataBits: 8 * Math.pow(2, desc.shiftBits),
		ways: desc.ways,

		readPorts: desc.readPorts,
		writePorts: desc.writePorts,
	})

	return {
		name,
		body: [
			{ signal: 'clk', width: 1, direction: 'input' },
			{ signal: 'rst', width: 1, direction: 'input' },
		],
	}
}
