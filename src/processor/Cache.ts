import assert from 'assert'
import { Constant, If, LogicalNot, Not, Ternary } from 'gateware-ts'
import { CacheDesc } from './Description'
import { BasicModule } from './Module'
import { firstSetIndex, logicalOpAll, prioritySelector, rangeFlatMap, rangeMap, recordRangeFlatMap, recordRangeFlatMap2 } from './Utils'

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
					[`read_valid_buf_${wayIndex}_${portIndex}`, 1],
					[`read_tag_buf_${wayIndex}_${portIndex}`, tagWidth],
					[`read_data_buf_${wayIndex}_${portIndex}`, dataWidth],

					[`read_match_${wayIndex}_${portIndex}`, 1],
				]),
				...recordRangeFlatMap2(desc.ways, desc.writePorts, (wayIndex, portIndex) => [
					[`write_valid_buf_${wayIndex}_${portIndex}`, 1],
					[`write_dirty_buf_${wayIndex}_${portIndex}`, 1],
					[`write_tag_buf_${wayIndex}_${portIndex}`, tagWidth],
					[`write_data_buf_${wayIndex}_${portIndex}`, dataWidth],

					[`write_match_${wayIndex}_${portIndex}`, 1],
				]),
				...recordRangeFlatMap(desc.readPorts, (portIndex) => [
					[`read_in_progress_${portIndex}`, 1],
					[`read_selector_${portIndex}`, selectorWidth],
					[`read_compare_tag_${portIndex}`, tagWidth],
				]),
				...recordRangeFlatMap(desc.writePorts, (portIndex) => [
					[`write_in_progress_${portIndex}`, 1],
					[`write_selector_${portIndex}`, selectorWidth],
					[`write_compare_tag_${portIndex}`, tagWidth],

					[`write_data_selector_buf_${portIndex}`, selectorWidth],
					[`write_data_valid_buf_${portIndex}`, 1],
					[`write_data_dirty_buf_${portIndex}`, 1],
					[`write_data_data_buf_${portIndex}`, dataWidth],

					[`write_any_match_${portIndex}`, 1],
					[`write_all_valid_${portIndex}`, 1],
					[`write_pre_evict_${portIndex}`, 1],
					[`write_pre_selected_way_${portIndex}`, wayWidth],
					[`write_selected_way_${portIndex}`, wayWidth]
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

							// Selected way = any_match ? first_match_way : (all_valid ? pre_selected_way : first_invalid_way)
							const selectMatch = firstSetIndex(rangeMap(desc.ways, (wayIndex) => state[`write_match_${wayIndex}_${portIndex}`]))
							const selectInvalid = firstSetIndex(rangeMap(desc.ways, (wayIndex) => LogicalNot(state[`write_valid_buf_${wayIndex}_${portIndex}`])))
							const selectNoMatch = Ternary(state[`write_all_valid_${portIndex}`], state[`write_pre_selected_way_${portIndex}`], selectInvalid)
							const selectedWay = Ternary(anyMatch, selectMatch, selectNoMatch)

							return [
								state[`write_selector_${portIndex}`] ['='] (state[`write_address_${portIndex}`].slice(shiftWidth, shiftWidth + selectorWidth - 1)),
								state[`write_all_valid_${portIndex}`] ['='] (logicalOpAll('&&', rangeMap(desc.ways, (wayIndex) => state[`write_valid_buf_${wayIndex}_${portIndex}`]))),
								anyMatch ['='] (logicalOpAll('||', rangeMap(desc.ways, (wayIndex) => state[`write_match_${wayIndex}_${portIndex}`]))),
								state[`write_pre_evict_${portIndex}`] ['='] (Not(anyMatch) ['&&'] (state[`write_all_valid_${portIndex}`])),
								state[`write_selected_way_${portIndex}`] ['='] (selectedWay),
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
									state[`write_tag_buf_${wayIndex}_${portIndex}`] ['='] (arrays[`tags_${wayIndex}`].at(selector)),
									state[`write_data_buf_${wayIndex}_${portIndex}`] ['='] (arrays[`data_${wayIndex}`].at(selector)),
								]
							}),
						]),

						// Cycle two for read/write ops, generating output
						...rangeFlatMap(desc.readPorts, (portIndex) => [
							state[`read_complete_${portIndex}`] ['='] (state[`read_in_progress_${portIndex}`]),
							state[`read_hit_${portIndex}`] ['='] (logicalOpAll('||', rangeMap(desc.ways, (wayIndex) => state[`read_match_${wayIndex}_${portIndex}`]))),
							state[`read_data_${portIndex}`] ['='] (
								prioritySelector(rangeMap(desc.ways, (wayIndex) => [state[`read_data_buf_${wayIndex}_${portIndex}`], state[`read_match_${wayIndex}_${portIndex}`]]), dataWidth)
							),
						]),
						...rangeFlatMap(desc.writePorts, (portIndex) => [
							state[`write_complete_${portIndex}`] ['='] (state[`write_in_progress_${portIndex}`]),
							state[`write_evict_${portIndex}`] ['='] (state[`write_pre_evict_${portIndex}`]),
							If(state[`write_in_progress_${portIndex}`], rangeMap(desc.ways, (wayIndex) => {
								const selector = state[`write_data_selector_buf_${portIndex}`]

								return If(state[`write_selected_way_${portIndex}`] ['=='] (Constant(state[`write_selected_way_${portIndex}`].width, wayIndex)), [
									state[`valids_${wayIndex}`] ['='] (state[`valids_${wayIndex}`] ['|'] (state[`write_data_valid_buf_${portIndex}`] ['<<'] (selector))),
									state[`dirtys_${wayIndex}`] ['='] (state[`write_data_valid_buf_${portIndex}`]),
									arrays[`tags_${wayIndex}`].at(selector) ['='] (state[`write_compare_tag_${portIndex}`]),
									arrays[`data_${wayIndex}`].at(selector) ['='] (state[`write_data_data_buf_${portIndex}`]),
								])
							})),
						]),
					],
				}
			}
		})
	}
}
