import { Constant, SignalLike } from "gateware-ts"
import { DecoderTreeModule } from "./DecoderTree"
import { DecoderDesc, OperationDesc } from "./Description"
import { BasicModule } from "./Module"
import { indexArray, rangeFlatMap, rangeMap, reverseBits, signedShiftLeft } from "./Utils"

export class DecoderModule extends BasicModule {
	public constructor(
		name: string,
		desc: DecoderDesc,
		units: OperationDesc[],
	) {
		const decoders = desc.groups.map((lanes, i) => lanes.map((desc, j) => new DecoderTreeModule(`decoder_${i}_${j}`, desc, units)))
		const decoderWidths = decoders.map((lanes) => lanes.map((module) => module.inputPorts.instruction.width))
		const laneWidths = decoderWidths.map((lanes) => lanes.reduce((sum, width) => sum + width, 0))

		const headerBits = desc.shiftBits + desc.groups.reduce((sum, lanes) => sum + Math.ceil(Math.log2(lanes.length)), 0)
		const maxInstructionBits = headerBits + decoders.reduce((sum, lanes) => sum + lanes.reduce((sum, module) => sum + module.inputPorts.instruction.width, 0), 0)
		const maxInstructionBytes = Math.ceil(maxInstructionBits / 8)

		const stepCount = desc.groups.length >> 1

		super(name, {
			inputs: {
				instruction: 8 * maxInstructionBytes,
			},
			outputs: {
				shift_bytes: desc.shiftBits,
				...Object.fromEntries(decoders.flatMap((lanes, i) => lanes.flatMap((decoder, j) => [
					[`valid_${i}_${j}`, 1],
					[`opcode_${i}_${j}`, decoder.outputPorts.opcode.width],
					[`args_${i}_${j}`, decoder.outputPorts.args.width],
				])))
			},
			internals: {
				shift_bytes_temp: desc.shiftBits,
				...Object.fromEntries(decoders.map((lanes, i) => [`lane_count_${i}`, Math.ceil(Math.log2(lanes.length))])),
				...Object.fromEntries(rangeFlatMap(stepCount, (step) => {
					const stepWidth = laneWidths.reduce((sum, laneWidth, groupIndex) => {
						return sum + (groupIndex >= 2 * step + 1 ? laneWidth : 0)
					}, 0)

					const flipWidth = laneWidths[2 * step + 1]

					return [
						[`step_${step}_instruction`, stepWidth],
						[`step_${step}_slice`, flipWidth],
						[`step_${step}_flip`, flipWidth],
						...rangeMap(desc.groups.length - (2 * step + 1), (i) => [`step_${step}_lane_count_${i}`]),
					]
				}))
			},
			arrays: {},
			modules: Object.fromEntries(decoders.flatMap((lanes, i) => lanes.map((module, j) => [`decoder_${i}_${j}`, module]))),
			logic: (state) => {
				let index = desc.shiftBits
				const laneCounts = decoders.map((_, i) => {
					const bits = state[`lane_count_${i}`].width
					const result = state[`lane_count_${i}`] ['='] (state.instruction.slice(index, index + bits - 1))
					index += bits
					return result
				})
				
				return {
					logic: [
						...laneCounts,

						// Connect up slice and flip in instructions
						...rangeFlatMap(stepCount, (step) => {
							const sliceSize = decoders[2 * step + 1].reduce((sum, module) => sum + module.inputPorts.instruction.width, 0)

							return [
								state[`step_${step}_slice`] ['='] (state[`step_${step}_instruction`].slice(0, sliceSize - 1)),
								state[`step_${step}_flip`] ['='] (reverseBits(state[`step_${step}_slice`])),
							]
						}),

						// Connect up input instructions
						...decoders.flatMap((lanes, i) => {
							const step = (i - 1) >> 1
							const group = i === 0 ? state.instruction : (i & 1) === 1 ? state[`step_${step}_flip`] : state[`step_${step}_instruction`]
							let offset = i === 0 ? headerBits : (i & 1) === 1 ? 0 : decoders[i - 1].reduce((sum, module) => sum + module.inputPorts.instruction.width, 0)
							return lanes.map((_, j) => {
								const bits = state[`decoder_${i}_${j}_instruction`].width
								const result = state[`decoder_${i}_${j}_instruction`] ['='] (group.slice(offset, offset + bits - 1))
								offset += bits
								return result
							})
						})
					],
					state: [
						// Connect up shift_bytes
						state.shift_bytes ['='] (state.instruction.slice(0, desc.shiftBits - 1)),

						// Connect up outputs
						...decoders.flatMap((lanes, i) => {
							const step = (i - 1) >> 1
							const stepOffset = i & 1 ? 0 : i === decoders.length - 1 ? 0 : 1
							const laneCount = i === 0 ? state.lane_count_0 : state[`step_${step}_lane_count_${stepOffset}`]

							return lanes.flatMap((_, j) => {
								return [
									state[`valid_${i}_${j}`] ['='] (laneCount ['>='] (Constant(state[`lane_count_${i}`].width, j))),
									state[`opcode_${i}_${j}`] ['='] (state[`decoder_${i}_${j}_opcode`]),
									state[`args_${i}_${j}`] ['='] (state[`decoder_${i}_${j}_args`]),
								]
							})
						}),

						// Connect up step pipeline
						...rangeFlatMap(stepCount, (step) => {
							const instruction = step === 0 ? state.instruction : state[`state_${step - 1}_instruction`]
							const laneCounts = rangeMap(desc.groups.length, (i) => step === 0 ? state[`lane_count_${i}`] : state[`state_${step - 1}_lane_count_${i}`])
							const baseShift = step === 0 ? headerBits : decoders[2 * step - 1].reduce((sum, module) => sum + module.inputPorts.instruction.width, 0)

							return [
								state[`step_${step}_instruction`] ['='] (this.forwardInstruction(instruction, laneCounts, step, baseShift, decoders)),
								...laneCounts.slice(step === 0 ? 1 : 2).map((laneCount, i) => state[`step_${step}_lane_count_${i}`] ['='] (laneCount)),
							]
						}),
					]
				}
			}
		})
	}

	private forwardInstruction(instruction: SignalLike, laneCounts: SignalLike[], step: number, baseShift: number, decoders: DecoderTreeModule[][]): SignalLike {
		let shiftDown = baseShift
		const shiftTable = decoders[step * 2].map((module) => {
			shiftDown += module.inputPorts.instruction.width

			const row = decoders[step * 2 + 1]
			return row.map((_, i) => {
				const shiftUp = row.reduce((sum, val, j) => sum + (j >= i ? val.inputPorts.instruction.width : 0), 0)
				const finalShift = shiftUp - shiftDown
				return signedShiftLeft(instruction, finalShift)
			})
		})

		return indexArray(shiftTable.map((signals) => indexArray(signals, laneCounts[1])), laneCounts[0])
	}
}
