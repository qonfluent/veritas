import { pack, unpack } from 'msgpackr'
import crypto from 'crypto'

export type BlockID = Uint8Array
export type NodeID = Uint8Array

export type Timestamp = number

export type BlockObject = {
	timestamp: Timestamp
	parents: BlockID[]
	data: Uint8Array
	signature: Uint8Array
}

export class Block {
	public static fromObject(obj: BlockObject, hash?: (data: Uint8Array) => Uint8Array): Block {
		return new Block(obj.timestamp, obj.parents, obj.data, obj.signature, hash)
	}

	public static fromBytes(bytes: Uint8Array, hash?: (data: Uint8Array) => Uint8Array): Block {
		return Block.fromObject(unpack(bytes), hash)
	}

	private constructor(
		public readonly timestamp: Timestamp,
		public readonly parents: BlockID[],
		public readonly data: Uint8Array,
		public readonly signature: Uint8Array,
		private readonly _hash: (data: Uint8Array) => Uint8Array = (data) => crypto.createHash('sha256').update(data).digest(),
	) {}

	public get id(): BlockID {
		return this._hash(this.toBytes())
	}

	public toObject(includeSignature = true): object {
		return {
			parents: this.parents.map((parent) => bytesToHex(parent)),
			timestamp: this.timestamp,
			data: this.data,
			...(includeSignature ? { signature: this.signature } : {}),
		}
	}

	public toBytes(includeSignature = true): Uint8Array {
		return pack(this.toObject(includeSignature))
	}
}

export type BlockData = {
	arrivalTime: Timestamp
	block: Block
	source: string
	index: number
}

export type BlockStoreCursor = Map<string, number>

export function bytesToHex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('hex')
}

export function hexToBytes(hex: string): Uint8Array {
	return Buffer.from(hex, 'hex')
}

export interface IBlockStore {
	addNodes(...nodeID: NodeID[]): void
	getNodePing(nodeID: NodeID, history?: number): Timestamp

	getCursor(): BlockStoreCursor
	addBlock(block: Block): BlockID
	getDelta(cursor: BlockStoreCursor): Block[]
}

export class MemoryBlockStore implements IBlockStore {
	private readonly _blocks: Map<string, BlockData> = new Map()
	private readonly _nodeBlocks: Map<string, string[]> = new Map()

	public constructor(
		private readonly _validateJoin: (timestamp: Timestamp, source: NodeID, data: Uint8Array) => void = () => {},
	) {}

	public addNodes(...nodeID: NodeID[]): void {
		for (const node of nodeID) {
			const nodeIDStr = bytesToHex(node)

			if (this._nodeBlocks.has(nodeIDStr)) {
				throw new Error(`Node already exists: ${nodeIDStr}`)
			}

			this._nodeBlocks.set(nodeIDStr, [])
		}
	}

	public getNodePing(nodeID: NodeID, history = 5): Timestamp {
		// Load node blocks
		const nodeIDStr = bytesToHex(nodeID)
		const blocks = this._nodeBlocks.get(nodeIDStr)
		if (!blocks) {
			throw new Error(`Node does not exist: ${nodeIDStr}`)
		}

		// Get last N blocks
		const lastBlocks = blocks.slice(-history)

		// Calculate pings
		const deltas = lastBlocks.map((blockID) => {
			const block = this._blocks.get(blockID)!
			return block.arrivalTime - block.block.timestamp
		})

		// Calculate median
		deltas.sort()
		const center = Math.floor(deltas.length / 2)
		const median = (deltas[center] + (deltas.length % 2 === 0 ? deltas[center + 1] : 0)) / 2
		return median
	}

	public getCursor(): BlockStoreCursor {
		const cursor = new Map<string, number>()

		for (const [nodeID, blocks] of this._nodeBlocks) {
			cursor.set(nodeID, blocks.length)
		}

		return cursor
	}

	public addBlock(block: Block): BlockID {
		// Get block ID
		const blockID = bytesToHex(block.id)

		// ** Validate block format **

		// Validate parent count
		if (block.parents.length === 0) {
			throw new Error(`Block has no parents: ${blockID}`)
		}

		// Get parent ID
		const parentID = bytesToHex(block.parents[0])

		// Check signaure
		// TODO: Check signature

		// ** Validate block against store **

		// Check if block already exists
		if (this._blocks.has(blockID)) {
			throw new Error(`Block already exists: ${blockID}`)
		}

		// Check for normal vs genesis block
		if (block.parents.length > 1) {
			// Check if all parents are distinct
			const parentSet = new Set(block.parents)
			if (parentSet.size !== block.parents.length) {
				throw new Error(`Block has duplicate parents: ${blockID}`)
			}

			// Check if all parents exist
			for (const parent of block.parents) {
				const parentStr = bytesToHex(parent)
				if (!this._blocks.has(parentStr)) {
					throw new Error(`Parent block does not exist: ${parentStr}`)
				}
			}

			// Get source
			const parentBlock = this._blocks.get(parentID)!

			// Validate timestamp
			if (block.timestamp <= parentBlock.block.timestamp) {
				throw new Error(`Block timestamp is not greater than parent: ${blockID}`)
			}

			// Add block
			this.addBlockInner(blockID, block, parentBlock.source, parentBlock.index + 1)
		} else {
			// Validate block source exists
			const parentBlocks = this._nodeBlocks.get(parentID) ?? []
			if (parentBlocks.length !== 0) {
				throw new Error(`Parent node is not empty: ${parentID}`)
			}

			// Validate join message
			this._validateJoin(block.timestamp, block.parents[0], block.data)

			// Add block
			this.addBlockInner(blockID, block, parentID, 0)
		}

		return block.id
	}

	public getDelta(cursor: BlockStoreCursor): Block[] {
		// Ensure cursor has all nodes
		if (cursor.size !== this._nodeBlocks.size) {
			throw new Error('Cursor does not have all nodes')
		}

		// Visit nodes recursively, starting from the heads, stopping when we reach the cursor
		const delta = new Set<string>()
		const visited = new Set<string>()

		// Visit nodes, starting from the heads, stopping when we reach the cursor, sorted so parents are visited first
		const visit = (blockID: BlockID): void => {
			// Get block
			const blockIDStr = bytesToHex(blockID)
			const block = this._blocks.get(blockIDStr)!

			// Check if we've already visited this node
			if (visited.has(blockIDStr)) {
				return
			}

			// Check if we've reached the cursor
			const cursorIndex = cursor.get(block.source)!
			if (block.index < cursorIndex) {
				return
			}

			// Visit parents
			if (block.block.parents.length > 1) {
				for (const parent of block.block.parents) {
					visit(parent)
				}
			}

			// Add block to delta
			delta.add(blockIDStr)

			// Mark node as visited
			visited.add(blockIDStr)
		}

		// Visit heads
		for (const [nodeID, blocks] of this._nodeBlocks) {
			visit(hexToBytes(blocks[blocks.length - 1]))
		}

		return [...delta].map((blockID) => this._blocks.get(blockID)!.block)
	}

	private addBlockInner(blockID: string, block: Block, source: string, index: number): void {
		// Update blocks
		this._blocks.set(blockID, { block, source, index, arrivalTime: Date.now() })

		// Update node blocks
		const nodeBlocks = this._nodeBlocks.get(source) ?? []
		nodeBlocks.push(blockID)
		this._nodeBlocks.set(source, nodeBlocks)
	}
}

export enum MessageType {
	Push,
	Pull,
}

export type Message = {
	type: MessageType.Push,
	blocks: Block[],
} | {
	type: MessageType.Pull,
	cursor: BlockStoreCursor,
}

export class Node {
	public constructor(
		private readonly _id: NodeID,
		private readonly _store: IBlockStore,
	) {
		_store.addNodes(_id)
	}

	public get id(): NodeID {
		return this._id
	}

	public get cursor(): BlockStoreCursor {
		return this._store.getCursor()
	}

	public step(message: Message): Message[] {
		switch (message.type) {
			case MessageType.Push: {
				// Add blocks
				for (const block of message.blocks) {
					this._store.addBlock(block)
				}
				
				return []
			}
			case MessageType.Pull: {
				// Get delta
				const blocks = this._store.getDelta(message.cursor)

				// Send delta
				return [{
					type: MessageType.Push,
					blocks,
				}]
			}
		}
	}
}

describe('Four', () => {
	it('Block store works', () => {
		// Create store
		const store = new MemoryBlockStore()

		// Add nodes
		const source1 = crypto.randomBytes(32)
		const source2 = crypto.randomBytes(32)
		store.addNodes(source1, source2)

		// Add first block for source 1
		const block1 = Block.fromObject({ timestamp: 0, parents: [source1], data: new Uint8Array(), signature: new Uint8Array() })
		const block1ID = store.addBlock(block1)
		const oldCursor = store.getCursor()

		// Add first block for source 2
		const block2 = Block.fromObject({ timestamp: 1, parents: [source2], data: new Uint8Array(), signature: new Uint8Array() })
		const block2ID = store.addBlock(block2)

		// Add second block for source 1
		const block3 = Block.fromObject({ timestamp: 2, parents: [block1ID, block2ID], data: new Uint8Array(), signature: new Uint8Array() })
		const block3ID = store.addBlock(block3)

		// Get delta
		const delta = store.getDelta(oldCursor)
		expect(delta).toEqual([block2, block3])
	})

	it('Node works', () => {
		// Create nodes
		const node = new Node(new Uint8Array([0x1]), new MemoryBlockStore())

		// Get old cursor
		const oldCursor = node.cursor

		// Create block
		const block1 = Block.fromObject({ timestamp: 0, parents: [node.id], data: new Uint8Array(), signature: new Uint8Array() })

		// Push block
		const msgs1 = node.step({
			type: MessageType.Push,
			blocks: [block1],
		})

		expect(msgs1).toEqual([])

		// Pull block
		const msgs2 = node.step({
			type: MessageType.Pull,
			cursor: oldCursor,
		})

		expect(msgs2).toEqual([{
			type: MessageType.Push,
			blocks: [block1],
		}])
	})
})
