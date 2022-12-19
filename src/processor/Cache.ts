import assert from 'assert'
import { Constant, If, LogicalNot, Not, Ternary } from 'gateware-ts'
import { CacheDesc } from './Description'
import { BasicModule } from './Module'
import { firstSetIndex, logicalOpAll, prioritySelector } from './Utils'

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
				...Object.fromEntries([...Array(desc.readPorts)].flatMap((_, portIndex) => [
					[`read_${portIndex}`, 1],
					[`read_address_${portIndex}`, desc.addressBits],
				])),
				...Object.fromEntries([...Array(desc.writePorts)].flatMap((_, portIndex) => [
					[`write_${portIndex}`, 1],
					[`write_valid_${portIndex}`, 1],
					[`write_dirty_${portIndex}`, 1],
					[`write_address_${portIndex}`, desc.addressBits],
					[`write_data_${portIndex}`, dataWidth],
				])),
			},
			outputs: {
				...Object.fromEntries([...Array(desc.readPorts)].flatMap((_, portIndex) => [
					[`read_complete_${portIndex}`, 1],
					[`read_hit_${portIndex}`, 1],
					[`read_data_${portIndex}`, dataWidth],
				])),
				...Object.fromEntries([...Array(desc.writePorts)].flatMap((_, portIndex) => [
					[`write_complete_${portIndex}`, 1],
					[`write_evict_${portIndex}`, 1],
					[`write_evict_address_${portIndex}`, desc.addressBits],
					[`write_evict_data_${portIndex}`, dataWidth],
				])),
			},
			internals: {
				...Object.fromEntries([...Array(desc.ways)].flatMap((_, wayIndex) => [
					[`valids_${wayIndex}`, desc.rows],
					[`dirtys_${wayIndex}`, desc.rows],
					...[...Array(desc.readPorts)].flatMap((_, portIndex) => [
						[`read_valid_buf_${wayIndex}_${portIndex}`, 1],
						[`read_tag_buf_${wayIndex}_${portIndex}`, tagWidth],
						[`read_data_buf_${wayIndex}_${portIndex}`, dataWidth],

						[`read_match_${wayIndex}_${portIndex}`, 1]
					]),
					...[...Array(desc.writePorts)].flatMap((_, portIndex) => [
						[`write_valid_buf_${wayIndex}_${portIndex}`, 1],
						[`write_dirty_buf_${wayIndex}_${portIndex}`, 1],
						[`write_tag_buf_${wayIndex}_${portIndex}`, tagWidth],
						[`write_data_buf_${wayIndex}_${portIndex}`, dataWidth],

						[`write_match_${wayIndex}_${portIndex}`, 1],
					]),
				])),
				...Object.fromEntries([...Array(desc.readPorts)].flatMap((_, portIndex) => [
					[`read_in_progress_${portIndex}`, 1],
					[`read_selector_${portIndex}`, selectorWidth],
					[`read_compare_tag_${portIndex}`, tagWidth],
				])),
				...Object.fromEntries([...Array(desc.writePorts)].flatMap((_, portIndex) => [
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
				])),
			},
			arrays: Object.fromEntries([...Array(desc.ways)].flatMap((_, wayIndex) => [
				[`tags_${wayIndex}`, [tagWidth, desc.rows]],
				[`data_${wayIndex}`, [dataWidth, desc.rows]],
			])),
			registerOutputs: true,
			registers: [
				...[...Array(desc.ways)].flatMap((_, wayIndex) => [`valids_${wayIndex}`]),
			],
			logic: (state, arrays) => {
				return {
					logic: [
						// Connect read and write selectors and write way selection logic
						...[...Array(desc.readPorts)].flatMap((_, portIndex) => [
							state[`read_selector_${portIndex}`] ['='] (state[`read_address_${portIndex}`].slice(shiftWidth, shiftWidth + selectorWidth - 1)),
						]),
						...[...Array(desc.writePorts)].flatMap((_, portIndex) => {
							const anyMatch = state[`write_any_match_${portIndex}`]

							const selectMatch = firstSetIndex([...Array(desc.ways)].map((_, wayIndex) => state[`write_match_${wayIndex}_${portIndex}`]))
							const selectInvalid = firstSetIndex([...Array(desc.ways)].map((_, wayIndex) => LogicalNot(state[`write_valid_buf_${wayIndex}_${portIndex}`])))
							const selectNoMatch = Ternary(state[`write_all_valid_${portIndex}`], state[`write_pre_selected_way_${portIndex}`], selectInvalid)
							const selectedWay = Ternary(anyMatch, selectMatch, selectNoMatch)

							return [
								state[`write_selector_${portIndex}`] ['='] (state[`write_address_${portIndex}`].slice(shiftWidth, shiftWidth + selectorWidth - 1)),
								state[`write_all_valid_${portIndex}`] ['='] (logicalOpAll('&&', [...Array(desc.ways)].map((_, wayIndex) => state[`write_valid_buf_${wayIndex}_${portIndex}`]))),
								anyMatch ['='] (logicalOpAll('||', [...Array(desc.ways)].map((_, wayIndex) => state[`write_match_${wayIndex}_${portIndex}`]))),
								state[`write_pre_evict_${portIndex}`] ['='] (Not(anyMatch) ['&&'] (state[`write_all_valid_${portIndex}`])),
								state[`write_selected_way_${portIndex}`] ['='] (selectedWay),
							]
						}),

						// Connect match lines
						...[...Array(desc.ways)].flatMap((_, wayIndex) => [
							...[...Array(desc.readPorts)].map((_, portIndex) => {
								const valid = state[`read_valid_buf_${wayIndex}_${portIndex}`]
								const tagMatch = state[`read_compare_tag_${portIndex}`] ['=='] (state[`read_tag_buf_${wayIndex}_${portIndex}`])

								return state[`read_match_${wayIndex}_${portIndex}`] ['='] (valid ['&&'] (tagMatch))
							}),
							...[...Array(desc.writePorts)].map((_, portIndex) => {
								const valid = state[`write_valid_buf_${wayIndex}_${portIndex}`]
								const tagMatch = state[`write_compare_tag_${portIndex}`] ['=='] (state[`write_tag_buf_${wayIndex}_${portIndex}`])

								return state[`write_match_${wayIndex}_${portIndex}`] ['='] (valid ['&&'] (tagMatch))
							}),
						]),
					],
					state: [
						// Copy data forward to next cycle
						...[...Array(desc.readPorts)].flatMap((_, portIndex) => [
							state[`read_in_progress_${portIndex}`] ['='] (state[`read_${portIndex}`]),
							state[`read_compare_tag_${portIndex}`] ['='] (state[`read_address_${portIndex}`].slice(shiftWidth + selectorWidth, desc.addressBits - 1)),
						]),
						...[...Array(desc.writePorts)].flatMap((_, portIndex) => [
							state[`write_in_progress_${portIndex}`] ['='] (state[`write_${portIndex}`]),
							state[`write_compare_tag_${portIndex}`] ['='] (state[`write_address_${portIndex}`].slice(shiftWidth + selectorWidth, desc.addressBits - 1)),
							state[`write_data_selector_buf_${portIndex}`] ['='] (state[`write_selector_${portIndex}`]),

							state[`write_data_valid_buf_${portIndex}`] ['='] (state[`write_valid_${portIndex}`]),
							state[`write_data_dirty_buf_${portIndex}`] ['='] (state[`write_dirty_${portIndex}`]),
							state[`write_data_data_buf_${portIndex}`] ['='] (state[`write_data_${portIndex}`]),
						]),

						// Cycle one for read/write ops, loading data from arrays
						...[...Array(desc.ways)].flatMap((_, wayIndex) => [
							...[...Array(desc.readPorts)].flatMap((_, portIndex) => {
								const selector = state[`read_selector_${portIndex}`]

								return [
									state[`read_valid_buf_${wayIndex}_${portIndex}`] ['='] ((state[`valids_${wayIndex}`] ['>>'] (selector)) ['&'] (Constant(1, 1))),
									state[`read_tag_buf_${wayIndex}_${portIndex}`] ['='] (arrays[`tags_${wayIndex}`].at(selector)),
									state[`read_data_buf_${wayIndex}_${portIndex}`] ['='] (arrays[`data_${wayIndex}`].at(selector)),
								]
							}),
							...[...Array(desc.writePorts)].flatMap((_, portIndex) => {
								const selector = state[`write_selector_${portIndex}`]

								return [
									state[`write_valid_buf_${wayIndex}_${portIndex}`] ['='] ((state[`valids_${wayIndex}`] ['>>'] (selector)) ['&'] (Constant(1, 1))),
									state[`write_tag_buf_${wayIndex}_${portIndex}`] ['='] (arrays[`tags_${wayIndex}`].at(selector)),
									state[`write_data_buf_${wayIndex}_${portIndex}`] ['='] (arrays[`data_${wayIndex}`].at(selector)),
								]
							}),
						]),

						// Cycle two for read/write ops, generating output
						...[...Array(desc.readPorts)].flatMap((_, portIndex) => [
							state[`read_complete_${portIndex}`] ['='] (state[`read_in_progress_${portIndex}`]),
							state[`read_hit_${portIndex}`] ['='] (logicalOpAll('||', [...Array(desc.ways)].map((_, wayIndex) => state[`read_match_${wayIndex}_${portIndex}`]))),
							state[`read_data_${portIndex}`] ['='] (
								prioritySelector([...Array(desc.ways)].map((_, wayIndex) => [state[`read_data_buf_${wayIndex}_${portIndex}`], state[`read_match_${wayIndex}_${portIndex}`]]), dataWidth)
							),
						]),
						...[...Array(desc.writePorts)].flatMap((_, portIndex) => [
							state[`write_complete_${portIndex}`] ['='] (state[`write_in_progress_${portIndex}`]),
							state[`write_evict_${portIndex}`] ['='] (state[`write_pre_evict_${portIndex}`]),
							If(state[`write_in_progress_${portIndex}`], [...Array(desc.ways)].map((_, wayIndex) => {
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
