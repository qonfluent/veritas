import { ArgDesc, ArgName, OperationDesc, RegisterFileDesc, RegisterFileName } from '../common/Processor'
import PriorityQueue from 'ts-priority-queue'
import assert from 'assert'
import { RExpr, Stmt, VerilogModule } from '../hdl/Verilog'
import { clog2 } from '../common/Util'

export type DecoderTree = {
	opcode: number
	args: Record<ArgName, ArgDesc>
} | {
	zero: DecoderTree
	one: DecoderTree
}

export type DecoderQueueEntry = {
	tree: DecoderTree
	bits: number
	count: number
	argBits: number
}

export function createDecoderTree(ops: OperationDesc[], registerFiles: Record<RegisterFileName, RegisterFileDesc>): DecoderQueueEntry {
	if (ops.length === 0) {
		throw new Error('No operations')
	}

	// Create priority queue for operations
	const queue = new PriorityQueue<DecoderQueueEntry>({ comparator: (a, b) => a.bits - b.bits })
	ops.forEach((op, opcode) => {
		assert(op !== undefined && 'args' in op)

		const bits = Object.values(op.args).reduce((bits, arg) => {
			const argBits
				= 'immediateBits' in arg ? arg.immediateBits
				: 'registerFile' in arg ? Math.ceil(Math.log2(registerFiles[arg.registerFile].count))
				: 0

			return bits + argBits
		}, 0)

		queue.queue({ tree: { opcode, args: op.args }, bits, count: 1, argBits: bits })
	})

	// Create tree
	while (queue.length > 1) {
		const a = queue.dequeue()
		const b = queue.dequeue()

		queue.queue({
			tree: {
				zero: a.tree,
				one: b.tree,
			},
			bits: 1 + Math.max(a.bits, b.bits),
			count: a.count + b.count,
			argBits: Math.max(a.argBits, b.argBits),
		})
	}

	return queue.dequeue()
}

function createDecoderTreeInner(tree: DecoderQueueEntry, offset = 0): [RExpr, RExpr] {
	if ('opcode' in tree.tree) {
		return [
			tree.tree.opcode,
			['slice', 'instruction', offset, tree.argBits],
		]
	}

	const zero = createDecoderTreeInner({ ...tree, tree: tree.tree.zero }, offset + 1)
	const one = createDecoderTreeInner({ ...tree, tree: tree.tree.one }, offset + 1)

	return [
		['?:', ['index', 'instruction', offset], one[0], zero[0]],
		['?:', ['index', 'instruction', offset], one[1], zero[1]],
	]
}

export function createDecoderTreeModule(desc: DecoderQueueEntry): VerilogModule {
	const [opcode, args] = createDecoderTreeInner(desc)

	return {
		body: [
			['signal', 'clk', { width: 1, direction: 'input' }],
			['signal', 'rst', { width: 1, direction: 'input' }],

			['signal', 'instruction', { width: desc.bits, direction: 'input' }],
			['signal', 'opcode', { width: clog2(desc.count), direction: 'output' }],
			...(desc.argBits === 0 ? [] : [['signal', 'args', { width: desc.argBits, direction: 'output' }]] as Stmt[]),

			['always', ['posedge', 'clk'], [
				['if', 'rst', [
					['=', 'opcode', 0],
					...(desc.argBits ? [['=', 'args', 0] as Stmt] : []),
				], [
					['=', 'opcode', opcode],
					...(desc.argBits ? [['=', 'args', args] as Stmt] : []),
				]]
			]],
		],
	}
}
