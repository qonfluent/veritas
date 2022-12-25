import assert from 'assert'
import { Module, RExpr, Stmt } from '../hdl/Verilog'
import { clog2, rangeFlatMap, rangeMap } from '../Util'
import { createDecoderTree, DecoderTreeDescFull, fillDecoderTree, getArgsBits, getInstructionBits, getOpcodeBits } from './DecoderTree'

export type DecoderDesc = {
	groups: number[][][]
}

export type OperationArgs = {
	args: Record<string, number>
}

export function reverseBits(value: RExpr, bits: number): RExpr {
	return { concat: rangeMap(bits, (i) => ({ index: value, start: i })) }
}

export function signedShift(value: RExpr, bits: number): RExpr {
	if (bits === 0) {
		return value
	}

	return { binary: bits > 0 ? '<<' : '>>', left: value, right: Math.abs(bits) }
}

export function indexTable(table: RExpr[], index: RExpr, offset = 0): RExpr {
	if (table.length === 0) {
		throw new Error('Cannot index empty table')
	}

	if (table.length === 1) {
		return table[0]
	}

	return { ternary: { index, start: offset }, zero: indexTable(table.slice(0, table.length / 2), index, offset + 1), one: indexTable(table.slice(table.length / 2), index, offset + 1) }
}

export function shiftInstruction(instruction: RExpr, prefixBits: number, downCount: RExpr, downLengths: number[], upCount: RExpr, upLengths: number[]): RExpr {
	const downShifts = downLengths.map((_, i) => downLengths.reduce((sum, val, j) => sum + (i >= j ? val : 0), 0))
	const upShifts = upLengths.map((_, i) => upLengths.reduce((sum, val, j) => sum + (i < j ? val : 0), 0))
	const totalShifts = downShifts.map((down) => upShifts.map((up) => signedShift(instruction, up - down - prefixBits)))

	return indexTable(totalShifts.map((shifts) => indexTable(shifts, downCount)), upCount)
}

export function createDecoderTreeDescriptions(desc: DecoderDesc, operations: OperationArgs[]): DecoderTreeDescFull[][] {
	// Create the decoder trees for each lane
	const trees = desc.groups.map((lanes) => lanes.map((ops) => fillDecoderTree({
		ops: ops.map((op) => ({
			opcode: op,
			args: operations[op].args,
		})),
	})))

	return trees
}

export function createDecoder(name: string, desc: DecoderDesc, operations: OperationArgs[]): Module {
	// Create the decoder trees for each lane
	const trees = createDecoderTreeDescriptions(desc, operations)

	// Get lengths of each lane/group/total
	const laneLengths = trees.map((lanes) => lanes.map((tree) => getInstructionBits(tree)))
	const groupLengths = laneLengths.map((lanes) => lanes.reduce((sum, val) => sum + val, 0))
	const totalLength = groupLengths.reduce((sum, val) => sum + val, 0)

	// Get lengths of opcode and args for each group/lane
	const opcodeLengths = trees.map((lanes) => getOpcodeBits(lanes[0]))
	const argsLengths = trees.map((lanes) => lanes.map((tree) => getArgsBits(tree)))

	// Get header info
	const minLength = laneLengths.reduce((sum, lanes) => sum + lanes[0], 0)
	const shiftBits = clog2((totalLength - minLength) / 8)
	const laneCountLengths = laneLengths.map((lanes) => clog2(lanes.length))
	const headerBits = shiftBits + laneCountLengths.reduce((sum, val) => sum + val, 0)
	const instructionLength = headerBits + totalLength

	// Get step info
	const stepCount = (desc.groups.length - 1) >> 1

	return {
		name,
		body: [
			// Create input signals
			{ signal: 'clk', width: 1, direction: 'input' },
			{ signal: 'rst', width: 1, direction: 'input' },

			{ signal: 'instruction', width: instructionLength, direction: 'input' },
			{ signal: 'shiftBytes', width: Math.floor((headerBits + totalLength) / 8), direction: 'input' },

			// Create output signals
			...laneLengths.flatMap((lanes, i) => lanes.flatMap<Stmt>((_, j) => [
				{ signal: `valid_${i}_${j}`, width: 1, direction: 'output' },
				{ signal: `opcode_${i}_${j}`, width: opcodeLengths[i], direction: 'output' },
				{ signal: `args_${i}_${j}`, width: argsLengths[i][j], direction: 'output' },
			])),

			// Create internal input wires
			...groupLengths.map((groupLength, i) => ({ signal: `group_input_${i}`, width: groupLength })),

			// Lane count wires
			...laneCountLengths.map((laneCountLength, i) => ({ signal: `lane_count_${i}`, width: laneCountLength })),

			// Create internal step buffers
			...rangeMap(stepCount, (step) => ({ signal: `step_buffer_${step}`, width: groupLengths.reduce((sum, length, i) => i >= 2 * step + 1 ? sum + length : sum) })),

			// Create decoder trees
			...trees.flatMap((lanes, i) => lanes.map((tree, j) => {
				const start = laneLengths[i].slice(0, j).reduce((sum, val) => sum + val, 0)

				return {
					instance: `decoder_${i}_${j}`,
					module: createDecoderTree(`tree_${i}_${j}`, tree),
					ports: {
						clk: 'clk',
						rst: 'rst',
						
						instruction: `group_input_${i}`,
						opcode: `opcode_${i}_${j}`,
						args: `args_${i}_${j}`,
					},
				}
			})),

			// Connect group zero to instruction input
			{ assign: 'group_input_0', value: { slice: 'instruction', start: headerBits, end: headerBits + groupLengths[0] - 1 } },

			// Connect remaining groups to step buffers
			...rangeFlatMap(stepCount, (i) => [
				{ assign: `group_input_${i * 2 + 1}`, value: reverseBits(`step_buffer_${i}`, groupLengths[i * 2 + 1]) },
				...(desc.groups.length > i * 2 + 2 ? [
					{ assign: `group_input_${i * 2 + 2}`, value: { slice: `step_buffer_${i}`, start: groupLengths[i * 2 + 1], end: groupLengths[i * 2 + 1] + groupLengths[i * 2 + 2] } }
				] : []),
			]),

			// Connect up step buffers and valid bits
			{ always: 'clk', body: [
				{ if: 'rst', then: [
					...rangeMap(stepCount, (i) => ({ assign: `step_buffer_${i}`, value: 0 })),
				], else: [
					// Step buffers
					...rangeMap(stepCount, (i) => {
						if (i === 0) {
							return { assign: `step_buffer_${i}`, value: shiftInstruction('instruction', headerBits, 'lane_count_0', laneLengths[0], 'lane_count_1', laneLengths[1]) }
						}
		
						throw new Error('Not implemented')
					}),

					// Valid outputs
					...laneLengths.flatMap((lanes, i) => lanes.flatMap<Stmt>((_, j) => [
						{ assign: `valid_${i}_${j}`, value: { binary: '>=', left: `lane_count_${i}`, right: j} },
					])),
				] },
			]},
		]
	}
}
