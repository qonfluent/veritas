import { ArgDesc, ArgName, OperationDesc, RegisterFileDesc, RegisterFileName } from '../common/Processor'
import PriorityQueue from 'ts-priority-queue'

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
}

export function createDecoderTree(ops: OperationDesc[], registerFiles: Record<RegisterFileName, RegisterFileDesc>): DecoderQueueEntry {
	if (ops.length === 0) {
		throw new Error('No operations')
	}

	// Create priority queue for operations
	const queue = new PriorityQueue<DecoderQueueEntry>({ comparator: (a, b) => a.bits - b.bits })
	ops.forEach((op, opcode) => {
		const bits = Object.values(op.args).reduce((bits, arg) => {
			const argBits
				= 'immediateBits' in arg ? arg.immediateBits
				: 'registerFile' in arg ? Math.ceil(Math.log2(registerFiles[arg.registerFile].count))
				: 0

			return bits + argBits
		}, 0)

		queue.queue({ tree: { opcode, args: op.args }, bits })
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
		})
	}

	return queue.dequeue()
}
