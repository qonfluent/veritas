import assert from 'assert'
import { Constant, If, LogicalNot, Not, Ternary } from 'gateware-ts'
import { CacheDesc } from './Description'
import { BasicModule } from './Module'
import { firstSetIndex, indexArray, logicalOpAll, prioritySelector, rangeFlatMap, rangeMap, recordRangeFlatMap, recordRangeFlatMap2, setBit } from './Utils'

export class CacheModule extends BasicModule {
	public constructor(
		name: string,
		desc: CacheDesc,
	) {
		const dataWidth = 8 * desc.widthBytes
		const shiftWidth = Math.ceil(Math.log2(desc.widthBytes))
		const selectorWidth = Math.ceil(Math.log2(desc.rows))
		const tagWidth = desc.addressBits - selectorWidth - shiftWidth
		const wayWidth = Math.ceil(Math.log2(desc.ways + 1))

		assert(Math.pow(2, shiftWidth) === desc.widthBytes, `Width must by a power of two bytes`)
		assert(Math.pow(2, selectorWidth) === desc.rows, `Rows must be a power of two`)

		super(name, {
			inputs: {
				...recordRangeFlatMap(desc.readPorts, (portIndex) => [
					[`read_${portIndex}`, 1],
					[`read_address_${portIndex}`, desc.addressBits],
				]),
				...recordRangeFlatMap(desc.writePorts, (portIndex) => [
					[`write_${portIndex}`, 1],
					[`write_valid_${portIndex}`, 1],
					[`write_dirty_${portIndex}`, 1],
					[`write_address_${portIndex}`, desc.addressBits],
					[`write_data_${portIndex}`, dataWidth],
				]),
			},
			outputs: {
				...recordRangeFlatMap(desc.readPorts, (portIndex) => [
					[`read_complete_${portIndex}`, 1],
					[`read_hit_${portIndex}`, 1],
					[`read_data_${portIndex}`, dataWidth],
				]),
				...recordRangeFlatMap(desc.writePorts, (portIndex) => [
					[`write_complete_${portIndex}`, 1],
					[`write_evict_${portIndex}`, 1],
					[`write_evict_address_${portIndex}`, desc.addressBits],
					[`write_evict_data_${portIndex}`, dataWidth],
				]),
			},
			internals: {
				...recordRangeFlatMap(desc.ways, (wayIndex) => [
					[`valids_${wayIndex}`, desc.rows],
					[`dirtys_${wayIndex}`, desc.rows],
				]),
				...recordRangeFlatMap2(desc.ways, desc.readPorts, (wayIndex, portIndex) => [
					// Registers loaded during each access cycle
					[`read_valid_buf_${wayIndex}_${portIndex}`, 1],
					[`read_tag_buf_${wayIndex}_${portIndex}`, tagWidth],
					[`read_data_buf_${wayIndex}_${portIndex}`, dataWidth],

					// Wires for recording the match state of the port
					[`read_match_${wayIndex}_${portIndex}`, 1],
				]),
				...recordRangeFlatMap2(desc.ways, desc.writePorts, (wayIndex, portIndex) => [
					// Registers loaded during each access cycle
					[`write_valid_buf_${wayIndex}_${portIndex}`, 1],
					[`write_dirty_buf_${wayIndex}_${portIndex}`, 1],
					[`write_tag_buf_${wayIndex}_${portIndex}`, tagWidth],
					[`write_data_buf_${wayIndex}_${portIndex}`, dataWidth],

					// Wires for recording the match state of the port
					[`write_match_${wayIndex}_${portIndex}`, 1],
				]),
				...recordRangeFlatMap(desc.readPorts, (portIndex) => [
					// Wire to extract read selector
					[`read_selector_${portIndex}`, selectorWidth],

					// Registers for forwarding data to cycle 2
					[`read_in_progress_${portIndex}`, 1],
					[`read_compare_tag_${portIndex}`, tagWidth],
				]),
				...recordRangeFlatMap(desc.writePorts, (portIndex) => [
					// Wire to extract write selector
					[`write_selector_${portIndex}`, selectorWidth],

					// Registers for forwarding data to cycle 2
					[`write_in_progress_${portIndex}`, 1],
					[`write_compare_tag_${portIndex}`, tagWidth],
					[`write_data_selector_buf_${portIndex}`, selectorWidth],
					[`write_data_valid_buf_${portIndex}`, 1],
					[`write_data_dirty_buf_${portIndex}`, 1],
					[`write_data_data_buf_${portIndex}`, dataWidth],

					// Wires for way selection logic
					[`write_any_match_${portIndex}`, 1],
					[`write_all_valid_${portIndex}`, 1],
					[`write_pre_evict_${portIndex}`, 1],
					[`write_pre_selected_way_${portIndex}`, wayWidth],

					// Registers for way selection logic
					[`write_selected_way_${portIndex}`, wayWidth],
				]),
			},
			arrays: recordRangeFlatMap(desc.ways, (wayIndex) => [
				[`tags_${wayIndex}`, [tagWidth, desc.rows]],
				[`data_${wayIndex}`, [dataWidth, desc.rows]],
			]),
			registerOutputs: true,
			registers: [
				...rangeFlatMap(desc.ways, (wayIndex) => [`valids_${wayIndex}`]),
			],
			logic: (state, arrays) => {
				return {
					logic: [
						// Connect read and write selectors and write way selection logic
						...rangeFlatMap(desc.readPorts, (portIndex) => [
							state[`read_selector_${portIndex}`] ['='] (state[`read_address_${portIndex}`].slice(shiftWidth, shiftWidth + selectorWidth - 1)),
						]),
						...rangeFlatMap(desc.writePorts, (portIndex) => {
							const anyMatch = state[`write_any_match_${portIndex}`]
							const allValid = state[`write_all_valid_${portIndex}`]
							const preSelectedWay = state[`write_pre_selected_way_${portIndex}`]

							// Selected way = any_match ? first_match_way : (all_valid ? pre_selected_way : first_invalid_way)
							const selectMatch = firstSetIndex(rangeMap(desc.ways, (wayIndex) => state[`write_match_${wayIndex}_${portIndex}`]))
							const selectInvalid = firstSetIndex(rangeMap(desc.ways, (wayIndex) => LogicalNot(state[`write_valid_buf_${wayIndex}_${portIndex}`])))
							const selectNoMatch = Ternary(state[`write_all_valid_${portIndex}`], preSelectedWay, selectInvalid)
							const selectedWay = Ternary(anyMatch, selectMatch, selectNoMatch)
							const selectedDirty = indexArray(rangeMap(desc.ways, (wayIndex) => state[`write_dirty_buf_${wayIndex}_${portIndex}`]), preSelectedWay)

							return [
								state[`write_selector_${portIndex}`] ['='] (state[`write_address_${portIndex}`].slice(shiftWidth, shiftWidth + selectorWidth - 1)),
								allValid ['='] (logicalOpAll('&&', rangeMap(desc.ways, (wayIndex) => state[`write_valid_buf_${wayIndex}_${portIndex}`]))),
								anyMatch ['='] (logicalOpAll('||', rangeMap(desc.ways, (wayIndex) => state[`write_match_${wayIndex}_${portIndex}`]))),
								state[`write_selected_way_${portIndex}`] ['='] (selectedWay),
								state[`write_pre_evict_${portIndex}`] ['='] (Not(anyMatch) ['&&'] (allValid ['&&'] (selectedDirty))),
							]
						}),

						// Connect match lines
						...rangeFlatMap(desc.ways, (wayIndex) => [
							...rangeMap(desc.readPorts, (portIndex) => {
								const valid = state[`read_valid_buf_${wayIndex}_${portIndex}`]
								const tagMatch = state[`read_compare_tag_${portIndex}`] ['=='] (state[`read_tag_buf_${wayIndex}_${portIndex}`])

								return state[`read_match_${wayIndex}_${portIndex}`] ['='] (valid ['&&'] (tagMatch))
							}),
							...rangeMap(desc.writePorts, (portIndex) => {
								const valid = state[`write_valid_buf_${wayIndex}_${portIndex}`]
								const tagMatch = state[`write_compare_tag_${portIndex}`] ['=='] (state[`write_tag_buf_${wayIndex}_${portIndex}`])

								return state[`write_match_${wayIndex}_${portIndex}`] ['='] (valid ['&&'] (tagMatch))
							}),
						]),
					],
					state: [
						// Copy data forward to next cycle
						...rangeFlatMap(desc.readPorts, (portIndex) => [
							state[`read_in_progress_${portIndex}`] ['='] (state[`read_${portIndex}`]),
							state[`read_compare_tag_${portIndex}`] ['='] (state[`read_address_${portIndex}`].slice(shiftWidth + selectorWidth, desc.addressBits - 1)),
						]),
						...rangeFlatMap(desc.writePorts, (portIndex) => [
							state[`write_in_progress_${portIndex}`] ['='] (state[`write_${portIndex}`]),
							state[`write_compare_tag_${portIndex}`] ['='] (state[`write_address_${portIndex}`].slice(shiftWidth + selectorWidth, desc.addressBits - 1)),
							state[`write_data_selector_buf_${portIndex}`] ['='] (state[`write_selector_${portIndex}`]),

							state[`write_data_valid_buf_${portIndex}`] ['='] (state[`write_valid_${portIndex}`]),
							state[`write_data_dirty_buf_${portIndex}`] ['='] (state[`write_dirty_${portIndex}`]),
							state[`write_data_data_buf_${portIndex}`] ['='] (state[`write_data_${portIndex}`]),
						]),

						// Cycle one for read/write ops, loading data from arrays
						...rangeFlatMap(desc.ways, (wayIndex) => [
							...rangeFlatMap(desc.readPorts, (portIndex) => {
								const selector = state[`read_selector_${portIndex}`]

								return [
									state[`read_valid_buf_${wayIndex}_${portIndex}`] ['='] ((state[`valids_${wayIndex}`] ['>>'] (selector)) ['&'] (Constant(1, 1))),
									state[`read_tag_buf_${wayIndex}_${portIndex}`] ['='] (arrays[`tags_${wayIndex}`].at(selector)),
									state[`read_data_buf_${wayIndex}_${portIndex}`] ['='] (arrays[`data_${wayIndex}`].at(selector)),
								]
							}),
							...rangeFlatMap(desc.writePorts, (portIndex) => {
								const selector = state[`write_selector_${portIndex}`]

								return [
									state[`write_valid_buf_${wayIndex}_${portIndex}`] ['='] ((state[`valids_${wayIndex}`] ['>>'] (selector)) ['&'] (Constant(1, 1))),
									state[`write_dirty_buf_${wayIndex}_${portIndex}`] ['='] ((state[`dirtys_${wayIndex}`] ['>>'] (selector)) ['&'] (Constant(1, 1))),
									state[`write_tag_buf_${wayIndex}_${portIndex}`] ['='] (arrays[`tags_${wayIndex}`].at(selector)),
									state[`write_data_buf_${wayIndex}_${portIndex}`] ['='] (arrays[`data_${wayIndex}`].at(selector)),
								]
							}),
						]),

						// Cycle two for read ports, write outputs
						...rangeFlatMap(desc.readPorts, (portIndex) => [
							state[`read_complete_${portIndex}`] ['='] (state[`read_in_progress_${portIndex}`]),
							state[`read_hit_${portIndex}`] ['='] (logicalOpAll('||', rangeMap(desc.ways, (wayIndex) => state[`read_match_${wayIndex}_${portIndex}`]))),
							state[`read_data_${portIndex}`] ['='] (
								prioritySelector(rangeMap(desc.ways, (wayIndex) => [state[`read_data_buf_${wayIndex}_${portIndex}`], state[`read_match_${wayIndex}_${portIndex}`]]), dataWidth)
							),
						]),

						// Cycle two for write ports, write outputs and update way data
						...rangeFlatMap(desc.writePorts, (portIndex) => [
							// Update output state
							state[`write_complete_${portIndex}`] ['='] (state[`write_in_progress_${portIndex}`]),
							state[`write_evict_${portIndex}`] ['='] (state[`write_pre_evict_${portIndex}`]),
							state[`write_evict_data_${portIndex}`] ['='] (
								indexArray(rangeMap(desc.ways, (wayIndex) => state[`write_data_buf_${wayIndex}_${portIndex}`]), state[`write_selected_way_${portIndex}`])
							),

							// TODO: Might be better to add one more cycle of delay here to cache the selected way?
							// Check if we need to write anything
							If(state[`write_in_progress_${portIndex}`], rangeMap(desc.ways, (wayIndex) => {
								const selector = state[`write_data_selector_buf_${portIndex}`]

								// Check if this is the selected way
								return If(state[`write_selected_way_${portIndex}`] ['=='] (Constant(state[`write_selected_way_${portIndex}`].width, wayIndex)), [
									// Check if we are writing data or invalidating
									If(state[`write_data_valid_buf_${portIndex}`], [
										// Update all state on a valid write
										state[`valids_${wayIndex}`] ['='] (state[`valids_${wayIndex}`] ['|'] (Constant(1, 1) ['<<'] (selector))),
										state[`dirtys_${wayIndex}`] ['='] (setBit(state[`dirtys_${wayIndex}`], selector, state[`write_data_dirty_buf_${portIndex}`])),
										arrays[`tags_${wayIndex}`].at(selector) ['='] (state[`write_compare_tag_${portIndex}`]),
										arrays[`data_${wayIndex}`].at(selector) ['='] (state[`write_data_data_buf_${portIndex}`]),
									]).ElseIf(state[`write_any_match_${portIndex}`], [
										// Update valid bit on an invalidation
										state[`valids_${wayIndex}`] ['='] (state[`valids_${wayIndex}`] ['&'] (Not(Constant(1, 1) ['<<'] (selector)))),
									])
								])
							})),
						]),
					],
				}
			}
		})
	}
}
