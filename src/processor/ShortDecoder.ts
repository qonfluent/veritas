import { clog2, rangeMap } from '../common/Util'
import { Module } from '../hdl/Module'
import { Stmt } from '../hdl/Verilog'
import { flipBits } from './Common'
import { createDecoderTreeModule, DecoderQueueEntry } from './DecoderTree'

export type ShortDecoderDesc = {
	groups: DecoderQueueEntry[][]
}

export function getMaxBodyBits(desc: ShortDecoderDesc): number {
	return desc.groups.reduce((sum, lanes) => sum + lanes.reduce((sum, { bits }) => sum + bits, 0), 0)
}

export function createShortDecoderModule(desc: ShortDecoderDesc): Module {
	const trees = desc.groups.map((group) => group.map((tree) => createDecoderTreeModule(tree)))

	const bodyBits = getMaxBodyBits(desc)

	const shiftBits = clog2(Math.ceil(bodyBits / 8))
	const laneCountBits = desc.groups.map((lanes) => clog2(lanes.length))
	const laneCountOffsets = laneCountBits.map((_, i) => laneCountBits.reduce((sum, bits, j) => sum + (j < i ? bits : 0), 0))
	const headerBits = shiftBits + laneCountBits.reduce((sum, bits) => sum + bits, 0)
	const groupBits = desc.groups.map((lanes) => lanes.reduce((sum, { bits }) => sum + bits, 0))

	// Every odd entry is 0, every even is the previous group's width
	const groupOffsets = desc.groups.map((_, i) => i === 0 || (i & 1) !== 0 ? 0 : groupBits[i - 1])

	const regWidths = rangeMap((desc.groups.length - 1) >> 1, (i) => groupBits.reduce((sum, bits, j) => sum + (j > 2 * i ? bits : 0), 0))

	return {
		body: [
			// Create IO ports
			['signal', 'clk', { width: 1, direction: 'input' }],
			['signal', 'rst', { width: 1, direction: 'input' }],

			['signal', 'valid', { width: 1, direction: 'input' }],
			['signal', 'instruction', { width: headerBits + bodyBits, direction: 'input' }],
			['signal', 'shiftBytes', { width: shiftBits, direction: 'output' }],
			...desc.groups.flatMap((lanes, i) => lanes.flatMap<Stmt>((decoder, j) => [
				['signal', `valid_${i}_${j}`, { width: 1, direction: 'output' }],
				['signal', `opcode_${i}_${j}`, { width: clog2(decoder.count), direction: 'output' }],
				...(decoder.argBits === 0 ? [] : [['signal', `args_${i}_${j}`, { width: decoder.argBits, direction: 'output' }] as Stmt]),
			])),

			// Create internal registers and wires
			...rangeMap<Stmt>((desc.groups.length - 1) >> 1, (i) => ['signal', `decoder_reg_${i}`, { width: regWidths[i] }]),
			...desc.groups.flatMap<Stmt>((_, i) => laneCountBits[i] ? [['signal', `laneCount_${i}`, { width: laneCountBits[i] }]] : []),

			// Create decoder trees
			...trees.flatMap((lanes, i) => lanes.map<Stmt>((_, j) => ['instance', `decoder_${i}_${j}`, `decoder_${i}_${j}`, {
				clk: 'clk',
				rst: 'rst',
				
				instruction:
					i === 0 ? ['slice', 'instruction', headerBits, groupBits[0]]
									// Flips the bits of the inner slice if the group is odd. This is to allow for the shifting operations to work nicely
									:  i & 1
										? flipBits(`decoder_reg_${(i - 1) >> 1}`, groupBits[i])
										: ['slice', `decoder_reg_${(i - 1) >> 1}`, groupOffsets[i], groupBits[i]]
			}])),
			...trees.flatMap((lanes, i) => lanes.map<Stmt>((module, j) => ['module', `decoder_${i}_${j}`, module])),

			// Assign lane counts
			...desc.groups.flatMap<Stmt>((_, i) => laneCountBits[i] ? [['=', `laneCount_${i}`, ['slice', 'instruction', laneCountOffsets[i], laneCountBits[i]]]] : []),

			['always', ['posedge', 'clk'], [
				['if', 'rst', [
					['=', 'shiftBytes', 0],
					...rangeMap<Stmt>((desc.groups.length - 1) >> 1, (i) => ['=', `decoder_reg_${i}`, 0]),
				], [
					// Assign outputs
					['=', 'shiftBytes', ['slice', 'instruction', 0, shiftBits]],
					...desc.groups.flatMap((lanes, i) => lanes.map<Stmt>((_, j) => {
						if (laneCountBits[i] === 0) {
							return ['=', `valid_${i}_${j}`, 'valid']
						}

						return ['=', `valid_${i}_${j}`, ['&&', 'valid', ['>=', `laneCount_${i}`, j]]]
					})),

					// Update the registers
					...rangeMap<Stmt>((desc.groups.length - 1) >> 1, (i) => {
						if (i === 0) {
							return ['=', `decoder_reg_${i}`, ['slice', 'instruction', headerBits, regWidths[i]]]
						}

						return ['=', `decoder_reg_${i}`, ['slice', `decoder_reg_${i - 1}`, groupOffsets[2 * i + 1], regWidths[i]]]
					}),
				]],
			]]
		]
	}
}
