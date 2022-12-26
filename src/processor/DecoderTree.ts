import { Module, RExpr, Stmt } from '../hdl/Verilog'
import { OperationArgs } from './Decoder'

export type DecoderTreeEntry = OperationArgs & {
	opcode: number
}

export type DecoderTreeDescSimple = {
	ops: DecoderTreeEntry[]
}

export type DecoderTreeDescFull = DecoderTreeEntry | {
	zero: DecoderTreeDescFull
	one: DecoderTreeDescFull
}

export function getArgBits(args: Record<string, number>): number {
	return Object.values(args).reduce((sum, val) => sum + val, 0)
}

export function fillDecoderTree(desc: DecoderTreeDescSimple): DecoderTreeDescFull {
	if (desc.ops.length === 0) {
		throw new Error('Cannot create decoder tree with no operations')
	}

	const weightedTrees: { tree: DecoderTreeDescFull, width: number}[] = desc.ops.map((entry) => {
		return { tree: entry, width: getArgBits(entry.args) }
	})
	const sortedTrees = weightedTrees.sort((a, b) => a.width - b.width)

	while (sortedTrees.length > 1) {
		const [a, b] = sortedTrees.splice(0, 2)
		const newEntry = { tree: { zero: a.tree, one: b.tree }, width: 1 + Math.max(a.width, b.width) }
		const index = sortedTrees.findIndex(entry => entry.width > newEntry.width)

		if (index === -1) {
			sortedTrees.push(newEntry)
		} else {
			sortedTrees.splice(index, 0, newEntry)
		}
	}

	return sortedTrees[0].tree
}

export function treeRecurse<T>(base: (opcode: number, argBits: Record<string, number>) => T, recur: (zero: T, one: T) => T, tree: DecoderTreeDescFull): T {
	if ('opcode' in tree) {
		return base(tree.opcode, tree.args)
	}

	return recur(treeRecurse(base, recur, tree.zero), treeRecurse(base, recur, tree.one))
}

export function getOperationCount(tree: DecoderTreeDescFull): number {
	return treeRecurse(() => 1, (a, b) => a + b, tree)
}

export function getOpcodeBits(tree: DecoderTreeDescFull): number {
	return Math.ceil(Math.log2(getOperationCount(tree)))
}

export function getArgsBits(tree: DecoderTreeDescFull): number {
	return getArgBits(treeRecurse((_, argBits) => argBits, (a, b) => ({ field: Math.max(getArgBits(a), getArgBits(b)) }), tree))
}

export function getInstructionBits(tree: DecoderTreeDescFull): number {
	return getArgBits(treeRecurse((_, argBits) => argBits, (a, b) => ({ field: 1 + Math.max(getArgBits(a), getArgBits(b))}), tree))
}

export function getOpcode(tree: DecoderTreeDescFull, instruction: RExpr, index = 0): RExpr {
	return treeRecurse<RExpr>((opcode) => opcode, (zero, one) => ({ ternary: { index: instruction, start: index }, zero, one }), tree)
}

export function createDecoderTreePorts(instructionBits: number, opcodeBits: number, argsBits: number): Stmt[] {
	return [
		{ signal: 'instruction', width: instructionBits, direction: 'input' },
		{ signal: 'opcode', width: opcodeBits, direction: 'output' },
		{ signal: 'args', width: argsBits, direction: 'output' },
	]
}

export function createDecoderTree(name: string, desc: DecoderTreeDescFull): Module {
	const opcodeBits = getOpcodeBits(desc)
	const argsBits = getArgsBits(desc)
	const instructionBits = getInstructionBits(desc)

	return {
		name,
		body: [
			// Generate IO ports
			{ signal: 'clk', width: 1, direction: 'input' },
			{ signal: 'rst', width: 1, direction: 'input' },

			...createDecoderTreePorts(instructionBits, opcodeBits, argsBits),

			// Generate decoder tree
			{ always: 'clk', body: [
				{ if: 'rst', then: [
					{ assign: 'opcode', value: 0 },
					{ assign: 'args', value: 0 },
				], else: [
					{ assign: 'opcode', value: getOpcode(desc, 'instruction') },
					{ assign: 'args', value: { slice: 'instruction', start: instructionBits - 1, end: instructionBits - argsBits  } },
				]},
			]},
		]
	}
}
