import { WideDecoderGroup } from '../common/Processor'
import { clog2 } from '../common/Util'
import { Module } from '../hdl/Module'
import { Stmt } from '../hdl/Verilog'

export type WideDecoderDesc = {
	// Operations per lane
	lanes: number[]
	// Arg groups
	groups: WideDecoderGroup[]
}

export function getOpcodeBits(desc: WideDecoderDesc): number[] {
	return desc.lanes.map((x) => clog2(x))
}

export function getArgCountBits(desc: WideDecoderDesc): number[] {
	return desc.groups.map((x) => 'split' in x ? clog2(x.split.length) : (x.invertable ? 1 : 0) + clog2(x.join.length))
}

export function getMaxBodyBits(desc: WideDecoderDesc): number {
	// Calculate bits for each lane's opcode, arg counts, and arg widths
	const opcodeBits = getOpcodeBits(desc)
	const argCountBits = getArgCountBits(desc)
	const argBits = desc.groups.map((x) => 'split' in x ? x.split.reduce((sum, arg) => sum + arg.width, 0) : x.join.reduce((sum, bits) => sum + bits, 0))
	
	// Calculate totals
	const totalOpcodeBits = opcodeBits.reduce((sum, bits) => sum + bits, 0)
	const totalArgCountBits = desc.lanes.length * argCountBits.reduce((sum, bits) => sum + bits, 0)
	const totalArgBits = desc.lanes.length * argBits.reduce((sum, bits) => sum + bits, 0)

	// Calculate header bits(shift + count)
	const maxBodyBits = totalOpcodeBits + totalArgCountBits + totalArgBits

	return maxBodyBits
}

// Format: [shiftBytes][laneCount]([opcode0][argCount00][argCount01]...)([arg00][arg01]...)([arg10][arg11]...)...
export function createWideDecoderTree(desc: WideDecoderDesc): Module {
	const maxBodyBits = getMaxBodyBits(desc)
	const shiftBits = clog2(maxBodyBits / 8)
	const countBits = clog2(desc.lanes.length)
	const headerBits = shiftBits + countBits

	// Calculate instruction bits
	const instructionBits = headerBits + maxBodyBits

	// Calculate opcode and arg count offsets
	const opcodeBits = getOpcodeBits(desc)
	const argCountBits = getArgCountBits(desc)
	const sliceBits = opcodeBits.map((opBits, i) => opBits + argCountBits[i])
	const opcodeOffset = sliceBits.map((_, i) => headerBits + sliceBits.reduce((sum, bits, j) => sum + (i > j ? bits : 0), 0))
	const argCountOffset = desc.groups.map((_, i) => argCountBits.reduce((sum, bits, j) => sum + (i > j ? bits : 0), 0))

	return {
		body: [
			// Inputs
			['signal', 'clk', { width: 1, direction: 'input' }],
			['signal', 'rst', { width: 1, direction: 'input' }],

			['signal', 'valid', { width: 1, direction: 'input' }],
			['signal', 'instruction', { width: instructionBits, direction: 'input' }],
			['signal', 'shiftBytes', { width: shiftBits, direction: 'input' }],

			// Outputs
			['signal', 'shift_bytes', { width: shiftBits, direction: 'output' }],
			...desc.lanes.flatMap<Stmt>((_, laneIndex) => [
				['signal', `valid_${laneIndex}`, { width: 1, direction: 'output' }],
				['signal', `opcode_${laneIndex}`, { width: opcodeBits[laneIndex], direction: 'output' }],
				...desc.groups.flatMap<Stmt>((group, groupIndex) => [
					['signal', `argCount_${laneIndex}_${groupIndex}`, { width: argCountBits[groupIndex], direction: 'output' }],
					...(
						'split' in group ? group.split.flatMap<Stmt>((arg, argIndex) => [
							['signal', `arg_${laneIndex}_${groupIndex}_${argIndex}`, { width: arg.width, direction: 'output' }],
						]) : [
							['signal', `arg_${laneIndex}_${groupIndex}`, { width: group.join.reduce((sum, bits) => sum + bits, 0), direction: 'output' }],
						] as Stmt[]
					),
				]),
			]),

			// Step function
			['always', ['posedge', 'clk'], [
				['if', 'rst', [
					// Clear all outputs
					...desc.lanes.flatMap<Stmt>((_, laneIndex) => [
						['=', `valid_${laneIndex}`, 0],
						['=', `opcode_${laneIndex}`, 0],
						...desc.groups.flatMap<Stmt>((group, groupIndex) => [
							['=', `argCount_${laneIndex}_${groupIndex}`, 0],
							...(
								'split' in group ? group.split.flatMap<Stmt>((_, argIndex) => [
									['=', `arg_${laneIndex}_${groupIndex}_${argIndex}`, 0],
								]) : [
									['=', `arg_${laneIndex}_${groupIndex}`, 0],
								] as Stmt[]
							),
						]),
					]),

					// TODO: Reset registers
				], [
					// --- CYCLE 1 ---
					// Set shift bytes
					['=', 'shift_bytes', ['slice', 'instruction', 0, shiftBits]],

					// Set valid, opcode, and arg counts
					...desc.lanes.flatMap<Stmt>((_, laneIndex) => [
						['=', `valid_${laneIndex}`, ['&&', 'valid', ['>=', laneIndex, ['slice', 'instruction', shiftBits, countBits]]]],
						['=', `opcode_${laneIndex}`, ['slice', 'instruction', opcodeOffset[laneIndex], opcodeBits[laneIndex]]],
						...desc.groups.flatMap<Stmt>((_, groupIndex) => [
							['=', `argCount_${laneIndex}_${groupIndex}`, ['slice', 'instruction', opcodeOffset[laneIndex] + opcodeBits[laneIndex] + argCountOffset[groupIndex], argCountBits[groupIndex]]],
						]),
					]),

					// --- CYCLE 2+ ---
					
				]],
			]]
		]
	}
}
