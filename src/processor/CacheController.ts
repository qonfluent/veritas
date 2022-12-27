import { Module, Stmt } from '../hdl/Verilog'
import { rangeFlatMap, recordRangeFlatMap } from '../Util'
import { createCache } from './Cache'

export type CacheControllerDesc = {
	shiftBits: number
	selectorBits: number
	bankBits: number[]
	upperBits: number
	ways: number

	readPorts: {
		retireStations: number
	}[]
	writePorts: {
		tristate: boolean
	}[]
}

export function createCacheController(name: string, desc: CacheControllerDesc): Module {
	const totalBankBits = desc.bankBits.reduce((a, b) => a + b, 0)
	const bankCount = Math.pow(2, totalBankBits)

	const unbankedAddressWidth = desc.shiftBits + desc.selectorBits + desc.upperBits
	const fullAddressWidth = unbankedAddressWidth + totalBankBits
	const dataBytes = Math.pow(2, desc.shiftBits)
	const dataWidth = 9 * dataBytes

	const cache = createCache(`${name}_cache`, {
		addressBits: unbankedAddressWidth,
		shiftBits: desc.shiftBits,
		selectorBits: desc.selectorBits,
		dataBits: dataWidth,
		ways: desc.ways,
		readPorts: desc.readPorts.length,
		writePorts: desc.writePorts.map((p) => p.tristate),
	})

	return {
		name,
		body: [
			{ signal: 'clk', width: 1, direction: 'input' },
			{ signal: 'rst', width: 1, direction: 'input' },

			// Create IO ports
			...rangeFlatMap<Stmt>(desc.readPorts.length, (portIndex) => [
				{ signal: `read_${portIndex}`, width: 1, direction: 'input' },
				{ signal: `read_address_${portIndex}`, width: fullAddressWidth, direction: 'input' },
				{ signal: `read_complete_${portIndex}`, width: 1, direction: 'output' },
				{ signal: `read_hit_${portIndex}`, width: 1, direction: 'output' },
				{ signal: `read_data_${portIndex}`, width: dataWidth, direction: 'output' },
			]),
			...rangeFlatMap<Stmt>(desc.writePorts.length, (portIndex) => [
				{ signal: `write_${portIndex}`, width: 1, direction: 'input' },
				{ signal: `write_valid_${portIndex}`, width: 1, direction: 'input' },
				{ signal: `write_valid_mask_${portIndex}`, width: dataBytes, direction: 'input' },
				{ signal: `write_address_${portIndex}`, width: fullAddressWidth, direction: 'input' },
			]),

			// Create internal signal arrays for banks
			{ signal: 'read_enables', width: bankCount, depth: [desc.readPorts.length] },
			{ signal: 'read_addresses', width: unbankedAddressWidth, depth: [desc.readPorts.length] },
			{ signal: 'read_completes', width: desc.readPorts.length },
			{ signal: 'read_hits', width: desc.readPorts.length },
			{ signal: 'read_data', width: dataWidth, depth: [desc.readPorts.length] },

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

					...Object.fromEntries(desc.readPorts.flatMap((_, portIndex) => [
						[`read_${portIndex}`, { index: 'read_enables', start: portIndex }],
						[`read_${portIndex}_address`, { index: 'read_addresses', start: portIndex }],
						[`read_${portIndex}_complete`, { index: 'read_completes', start: portIndex }],
						[`read_${portIndex}_hit`, { index: 'read_hits', start: portIndex }],
						[`read_${portIndex}_data`, { index: 'read_data', start: portIndex }],
					])),

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
			},

			// Create bank select registers
			...desc.bankBits.flatMap((bankBits, bankIndex) => {
				const totalBankBits = bankBits + desc.bankBits.slice(0, bankIndex).reduce((a, b) => a + b, 0)

				return [
					...desc.readPorts.flatMap((_, portIndex) => [
						{ signal: `read_${portIndex}_bank_select_${bankIndex}`, width: Math.pow(2, totalBankBits) },
					]),
					...desc.writePorts.flatMap((_, portIndex) => [
						{ signal: `write_${portIndex}_bank_select_${bankIndex}`, width: Math.pow(2, totalBankBits) },
					]),
				]
			}),

			// Create address forward registers
			{ signal: 'read_address_forward', width: fullAddressWidth, depth: [desc.readPorts.length, desc.bankBits.length] },
			{ signal: 'write_address_forward', width: fullAddressWidth, depth: [desc.writePorts.length, desc.bankBits.length] },

			// Create address forward logic
			{ always: 'clk', body: [
				{ if: 'rst', then: [
				], else: [
					// Connect up request forward logic for bank zero
					...(desc.bankBits.length > 0 ? [
						...desc.readPorts.flatMap((_, portIndex) => [
							{
								assign: { index: { index: 'read_address_forward', start: portIndex }, start: 0 },
								value: `read_address_${portIndex}`,
							},
							{
								assign: { index: { index: 'write_address_forward', start: portIndex }, start: 0 },
								value: `write_address_${portIndex}`,
							}
						]),
					] : []),

					// Connect up request forward logic for remaining banks
					{ for: 'i', init: 1, cond: { binary: '<', left: 'i', right: desc.bankBits.length }, step: { binary: '+', left: 'i', right: 1 }, body: [
						{ for: 'j', init: 0, cond: { binary: '<', left: 'j', right: desc.readPorts.length }, step: { binary: '+', left: 'j', right: 1 }, body: [
							{
								assign: { index: { index: 'read_address_forward', start: 'j' }, start: 'i' },
								value: { index: { index: 'read_address_forward', start: 'j' }, start: { binary: '-', left: 'i', right: 1 } },
							}
						] },

						{ for: 'j', init: 0, cond: { binary: '<', left: 'j', right: desc.writePorts.length }, step: { binary: '+', left: 'j', right: 1 }, body: [
							{
								assign: { index: { index: 'write_address_forward', start: 'j' }, start: 'i' },
								value: { index: { index: 'write_address_forward', start: 'j' }, start: { binary: '-', left: 'i', right: 1 } },
							}
						] },
					] },

					// Connect up bank select logic
					...desc.bankBits.flatMap<Stmt>((bankBits, bankIndex) => {
						const prevBankBits = desc.bankBits.slice(0, bankIndex).reduce((a, b) => a + b, 0)
						const start = desc.shiftBits + desc.selectorBits + prevBankBits
						const end = start + bankBits - 1

						// Connect bank 0 directly to the inputs
						if (bankIndex === 0) {
							return [
								...desc.readPorts.flatMap<Stmt>((_, portIndex) => [
									{ assign: `read_${portIndex}_bank_select_${bankIndex}`, value: { binary: '<<', left: `read_${portIndex}`, right: { slice: `read_address_${portIndex}`, start, end } } },
								]),
								...desc.writePorts.flatMap<Stmt>((_, portIndex) => [
									{ assign: `write_${portIndex}_bank_select_${bankIndex}`, value: { binary: '<<', left: `write_${portIndex}`, right: { slice: `write_address_${portIndex}`, start, end } } },
								]),
							]
						}

						// Connect remaining bank select registers to previous bank select registers
						const bankSelectorWidth = Math.pow(2, bankBits)

						return [
							// There are 2**prevBankBits bits in the previous bank select register, each connected to 2**bankBits bits in the current bank select register
							{ for: 'i', init: 0, cond: { binary: '<', left: 'i', right: Math.pow(2, prevBankBits) }, step: { binary: '+', left: 'i', right: 1 }, body: [
								...desc.readPorts.flatMap<Stmt>((_, portIndex) => [
									{
										assign: {
											slice: `read_${portIndex}_bank_select_${bankIndex}`,
											start: { binary: '*', left: 'i', right: bankSelectorWidth },
											endOffset: bankSelectorWidth,
										},
										value: {
											binary: '<<',
											left: { index: `read_${portIndex}_bank_select_${bankIndex - 1}`, start: 'i' },
											right: { slice: `read_address_${portIndex}`, start, end },
										},
									}
								]),
								...desc.writePorts.flatMap<Stmt>((_, portIndex) => [
									{
										assign: {
											slice: `write_${portIndex}_bank_select_${bankIndex}`,
											start: { binary: '*', left: 'i', right: bankSelectorWidth },
											endOffset: bankSelectorWidth,
										},
										value: {
											binary: '<<',
											left: { index: `write_${portIndex}_bank_select_${bankIndex - 1}`, start: 'i' },
											right: { slice: { index: { index: 'write_address_forward', start: portIndex }, start: bankIndex - 1 }, start, end },
										},
									}
								]),
							] }
						]
					}),
				] },
			] },
		],
	}
}
