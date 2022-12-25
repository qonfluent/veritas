import { Stmt, Module } from '../hdl/Verilog'
import { clog2, rangeFlatMap } from '../Util'

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

export function createCachePorts(desc: CacheDesc): Stmt[] {
	return [
		// Read ports
		...rangeFlatMap<Stmt>(desc.readPorts, (portIndex) => [
			{ signal: `read_${portIndex}`, width: 1, direction: 'input' },
			{ signal: `read_${portIndex}_address`, width: desc.addressBits, direction: 'input' },

			{ signal: `read_${portIndex}_complete`, width: 1, direction: 'output' },
			{ signal: `read_${portIndex}_hit`, width: 1, direction: 'output' },
			{ signal: `read_${portIndex}_data`, width: desc.dataBits, direction: 'output' },
		]),

		// Write ports
		...rangeFlatMap<Stmt>(desc.writePorts, (portIndex) => [
			{ signal: `write_${portIndex}`, width: 1, direction: 'input' },
			{ signal: `write_${portIndex}_valid`, width: 1, direction: 'input' },
			{ signal: `write_${portIndex}_address`, width: desc.addressBits, direction: desc.tristateWriteBus ? 'inout' : 'input', type: desc.tristateWriteBus ? 'tri' : 'wire' },
			{ signal: `write_${portIndex}_data`, width: desc.dataBits, direction: desc.tristateWriteBus ? 'inout' : 'input', type: desc.tristateWriteBus ? 'tri' : 'wire' },

			{ signal: `write_${portIndex}_complete`, width: 1, direction: 'output' },
			{ signal: `write_${portIndex}_evict`, width: 1, direction: 'output' },
			...(desc.tristateWriteBus ? [] : [
				{ signal: `write_${portIndex}_evict_address`, width: desc.addressBits, direction: 'output' },
				{ signal: `write_${portIndex}_evict_data`, width: desc.dataBits, direction: 'output' },
			]) as Stmt[],
		]),
	]
}

export function createCache(name: string, desc: CacheDesc): Module {
	const tagWidth = desc.addressBits - desc.selectorBits - desc.shiftBits
	const rowCount = 2 ** desc.selectorBits
	const waysBits = clog2(desc.ways)

	return {
		name,
		body: [
			// Clock and reset
			{ signal: 'clk', width: 1, direction: 'input', type: 'wire' },
			{ signal: 'rst', width: 1, direction: 'input', type: 'wire' },

			// Create IO ports
			...createCachePorts(desc),

			// Wires
			{ signal: 'read_selectors', width: desc.selectorBits, depth: [desc.readPorts] },
			{ signal: 'read_matches', width: desc.ways, depth: [desc.readPorts] },
			{ signal: 'read_any_matches', width: desc.readPorts },
			{ signal: 'read_selected_ways', width: waysBits, depth: [desc.readPorts], type: 'wor' },

			{ signal: 'write_selectors', width: desc.selectorBits, depth: [desc.writePorts] },
			{ signal: 'write_matches', width: desc.ways, depth: [desc.writePorts] },
			{ signal: 'write_any_matches', width: desc.writePorts },
			{ signal: 'write_selected_ways', width: waysBits, depth: [desc.writePorts], type: 'wor' },
			{ signal: 'write_all_valid', width: desc.writePorts },

			// Input registers
			{ signal: 'read_in_progress', width: desc.readPorts },
			{ signal: 'read_tags', width: tagWidth, depth: [desc.readPorts] },

			{ signal: 'write_in_progress', width: desc.writePorts },
			{ signal: 'write_valids', width: desc.writePorts },
			{ signal: 'write_addresses', width: desc.addressBits, depth: [desc.writePorts] },
			{ signal: 'write_data', width: desc.dataBits, depth: [desc.writePorts] },

			// Internal registers
			{ signal: 'read_buf_valid', width: desc.readPorts, depth: [desc.ways] },
			{ signal: 'read_buf_tag', width: tagWidth, depth: [desc.readPorts, desc.ways] },
			{ signal: 'read_buf_data', width: desc.dataBits, depth: [desc.readPorts, desc.ways] },

			{ signal: 'write_buf_valid', width: desc.writePorts, depth: [desc.ways] },
			{ signal: 'write_buf_tag', width: tagWidth, depth: [desc.writePorts, desc.ways] },
			{ signal: 'write_buf_data', width: desc.dataBits, depth: [desc.writePorts, desc.ways] },

			// Memories
			{ signal: 'valids', width: rowCount, depth: [desc.ways] },
			{ signal: 'tags', width: tagWidth, depth: [rowCount, desc.ways] },
			{ signal: 'data', width: desc.dataBits, depth: [rowCount, desc.ways] },

			// Generate read/write selectors
			...rangeFlatMap<Stmt>(desc.readPorts, (portIndex) => [
				{
					assign: { index: 'read_selectors', start: portIndex },
					value: { slice: `read_${portIndex}_address`, start: desc.shiftBits, end: desc.shiftBits + desc.selectorBits - 1 }
				},
			]),
			...rangeFlatMap<Stmt>(desc.writePorts, (portIndex) => [
				{
					assign: { index: 'write_selectors', start: portIndex },
					value: { slice: `write_${portIndex}_address`, start: desc.shiftBits, end: desc.shiftBits + desc.selectorBits - 1 }
				},
			]),

			// Generate match bits and selected way
			{ for: 'gv_i', init: 0, cond: { binary: '<', left: 'gv_i', right: desc.ways }, step: { binary: '+', left: 'gv_i', right: 1 }, body: [
				// Read ports match bits
				{ for: 'gv_j', init: 0, cond: { binary: '<', left: 'gv_j', right: desc.readPorts }, step: { binary: '+', left: 'gv_j', right: 1 }, body: [
					{
						assign: { index: { index: 'read_matches', start: 'gv_j' }, start: 'gv_i' },
						value: {
							binary: '&&',
							left: { binary: '==', left: { index: { index: 'read_buf_tag', start: 'gv_j' }, start: 'gv_i' }, right: { index: 'read_tags', start: 'gv_j' } },
							right: { index: { index: 'read_buf_valid', start: 'gv_i'}, start: 'gv_j' },
						}
					},
					{
						assign: { index: 'read_selected_ways', start: 'gv_j' },
						value: { ternary: { index: { index: 'read_matches', start: 'gv_j' }, start: 'gv_i' }, one: 'gv_i', zero: 0 },
					}
				] },

				// Write ports match bits
				{ for: 'gv_j', init: 0, cond: { binary: '<', left: 'gv_j', right: desc.writePorts }, step: { binary: '+', left: 'gv_j', right: 1 }, body: [
					{
						assign: { index: { index: 'write_matches', start: 'gv_j' }, start: 'gv_i' },
						value: {
							binary: '&&',
							left: {
								binary: '==',
								left: { index: { index: 'write_buf_tag', start: 'gv_j' }, start: 'gv_i' },
								right: { slice: { index: 'write_addresses', start: 'gv_j' }, start: desc.shiftBits + desc.selectorBits, end: desc.addressBits - 1 }
							},
							right: { index: { index: 'write_buf_valid', start: 'gv_i'}, start: 'gv_j' },
						}
					},
				] },
			] },

			// Generate any_match, all_valid
			{ for: 'gv_i', init: 0, cond: { binary: '<', left: 'gv_i', right: desc.readPorts }, step: { binary: '+', left: 'gv_i', right: 1 }, body: [
				{ assign: { index: 'read_any_matches', start: 'gv_i' }, value: { unary: '|', value: { index: 'read_matches', start: 'gv_i' } } },
			] },
			{ for: 'gv_i', init: 0, cond: { binary: '<', left: 'gv_i', right: desc.writePorts }, step: { binary: '+', left: 'gv_i', right: 1 }, body: [
				{ assign: { index: 'write_any_matches', start: 'gv_i' }, value: { unary: '|', value: { index: 'write_matches', start: 'gv_i' } } },
				{ assign: { index: 'write_all_valid', start: 'gv_i' }, value: { unary: '&', value: { index: 'write_matches', start: 'gv_i' } } },
			] },

			// Step
			{ always: 'clk', body: [
				{ if: 'rst', then: [

				], else: [
					// Read data from inputs to port buffers
					...rangeFlatMap<Stmt>(desc.readPorts, (portIndex) => [
						{ assign: { index: 'read_in_progress', start: portIndex }, value: `read_${portIndex}` },
						{ assign: { index: 'read_tags', start: portIndex }, value: { slice: `read_${portIndex}_address`, start: desc.shiftBits + desc.selectorBits, end: desc.addressBits - 1 } },
					]),
					...rangeFlatMap<Stmt>(desc.writePorts, (portIndex) => [
						{ assign: { index: 'write_in_progress', start: portIndex }, value: `write_${portIndex}` },
						{ assign: { index: 'write_valids', start: portIndex }, value: `write_${portIndex}_valid` },
						{ assign: { index: 'write_addresses', start: portIndex }, value: `write_${portIndex}_address` },
						{ assign: { index: 'write_data', start: portIndex }, value: `write_${portIndex}_data` },
					]),

					// Update data selection from ways
					{ for: 'i', init: 0, cond: { binary: '<', left: 'i', right: desc.ways }, step: { binary: '+', left: 'i', right: 1 }, body: [
						{ for: 'j', init: 0, cond: { binary: '<', left: 'j', right: desc.readPorts }, step: { binary: '+', left: 'j', right: 1 }, body: [
							{ assign: { index: { index: 'read_buf_valid', start: 'j' }, start: 'i' }, value: { index: { index: 'valids', start: 'i' }, start: { index: 'read_selectors', start: 'j' } } },
							{ assign: { index: { index: 'read_buf_tag', start: 'j' }, start: 'i' }, value: { index: { index: 'tags', start: 'i' }, start: { index: 'read_selectors', start: 'j' } } },
							{ assign: { index: { index: 'read_buf_data', start: 'j' }, start: 'i' }, value: { index: { index: 'data', start: 'i' }, start: { index: 'read_selectors', start: 'j' } } },
						] },
						{ for: 'j', init: 0, cond: { binary: '<', left: 'j', right: desc.writePorts }, step: { binary: '+', left: 'j', right: 1 }, body: [
							{ assign: { index: { index: 'write_buf_valid', start: 'j' }, start: 'i' }, value: { index: { index: 'valids', start: 'i' }, start: { index: 'write_selectors', start: 'j' } } },
							{ assign: { index: { index: 'write_buf_tag', start: 'j' }, start: 'i' }, value: { index: { index: 'tags', start: 'i' }, start: { index: 'write_selectors', start: 'j' } } },
							{ assign: { index: { index: 'write_buf_data', start: 'j' }, start: 'i' }, value: { index: { index: 'data', start: 'i' }, start: { index: 'write_selectors', start: 'j' } } },
						] },
					] },

					// Cycle 2, generate outputs and update memory
					...rangeFlatMap<Stmt>(desc.readPorts, (portIndex) => [
						{ assign: `read_${portIndex}_complete`, value: { index: 'read_in_progress', start: portIndex } },
						{ assign: `read_${portIndex}_hit`, value: { index: 'read_any_matches', start: portIndex } },
						{ assign: `read_${portIndex}_data`, value: { index: { index: 'read_buf_data', start: portIndex }, start: { index: 'read_selected_ways', start: portIndex } } },
					]),
					...rangeFlatMap<Stmt>(desc.writePorts, (portIndex) => [
						{ assign: `write_${portIndex}_complete`, value: { index: 'write_in_progress', start: portIndex } },
						{ assign: `write_${portIndex}_evict`, value: { index: 'write_any_matches', start: portIndex } },
						{
							assign: desc.tristateWriteBus ? `write_${portIndex}_address` : `write_${portIndex}_evict_address`,
							value: {
								concat: [
									{ index: { index: 'write_buf_tag', start: portIndex }, start: { index: 'write_selected_ways', start: portIndex } },
									{ slice: { index: 'write_addresses', start: portIndex }, start: desc.shiftBits, end: desc.shiftBits + desc.selectorBits - 1 },
									{ value: 0, width: desc.shiftBits },
								]
							}
						},
						{
							assign: desc.tristateWriteBus ? `write_${portIndex}_data` : `write_${portIndex}_evict_data`,
							value: { index: { index: 'write_buf_data', start: portIndex }, start: { index: 'write_selected_ways', start: portIndex } }
						},

						// Update memory
						{ if: { index: 'write_in_progress', start: portIndex }, then: [
							{ assign: { index: 'valids', start: { index: 'write_selected_ways', start: portIndex } }, value: { index: 'write_valids', start: portIndex } },
							{ if: { index: 'write_valids', start: portIndex }, then: [
								{
									assign: { index: 'tags', start: { index: 'write_selected_ways', start: portIndex } },
									value: { slice: { index: 'write_addresses', start: portIndex }, start: desc.shiftBits + desc.selectorBits, end: desc.addressBits - 1 }
								},
								{ assign: { index: 'data', start: { index: 'write_selected_ways', start: portIndex } }, value: { index: 'write_data', start: portIndex } },
							] },
						] },
					]),
				] },
			] },
		],
	}
}
