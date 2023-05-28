import { unpack } from 'msgpackr'
import { Block, BlockID } from './Block'
import { NodeID } from './Node'
import { TimeInstant, TimeInterval, bytesToString } from './Utility'

export type Cursor = Map<NodeID, number>

export class BlockData {
	public constructor(
		public readonly block: Block,
		public readonly node: NodeID,
		public readonly index: number,
	) {}
}

export abstract class BlockStore {
	private readonly _pendingBlocks = new Map<TimeInstant, Block[]>()

	public constructor(
		protected readonly _blockId: (block: Block) => BlockID,
	) {}

	public abstract getCursor(): Cursor
	public abstract getHeads(): BlockID[]
	public abstract hasBlock(id: BlockID): boolean
	public abstract getBlockData(id: BlockID): BlockData | undefined
	public abstract getBlockByIndex(node: NodeID, index: number): Block | undefined
	protected abstract addBlockInner(id: BlockID, parent: NodeID, block: Block): void

	public acceptedTimeRange(): TimeInterval {
		const offset = 30_000
		return [Date.now() - offset, Date.now() + offset]
	}

	public add(block: Block): BlockID {
		// Get block ID and now
		const now = Date.now()
		const id = this._blockId(block)

		// Check if block already exists
		if (this.hasBlock(id)) {
			return id
		}

		// Validate block format
		this.validateBlockFormat(block)

		// Validate all parents are unique
		const parents = new Set(block.parents.map(bytesToString))
		if (parents.size !== block.parents.length) {
			throw new Error('Block has duplicate parents')
		}

		// Validate parents
		const node = block.parents.length === 0 ? this.validateGenesisBlock(block) : this.validateNormalBlock(block)

		// Add block
		this.addBlockInner(id, node, block)

		return id
	}

	public getDelta(cursor: Cursor): Block[] {
		// Visit blocks and return topological sort so parents are before children
		const blockIDs: BlockID[] = []
		const visited = new Set<BlockID>()

		const visit = (id: BlockID): void => {
			// Skip if already visited
			if (visited.has(id)) {
				return
			}

			// Get block data
			const data = this.getBlockData(id)
			if (data === undefined) {
				throw new Error(`Block ${bytesToString(id)} does not exist`)
			}

			// Check if block is before the cursor
			if (data.index < (cursor.get(data.node) ?? 0)) {
				return
			}

			// Visit all parents
			if (data.block.parents.length > 1) {
				for (const parent of data.block.parents) {
					visit(parent)
				}
			}

			blockIDs.push(id)
			visited.add(id)
		}

		// Visit all of our heads
		this.getHeads().forEach(visit)

		// Return blocks
		return blockIDs.map((id) => this.getBlockData(id)!.block)
	}

	public processPending(): void {
		// Get min timestamp
		const [min] = this.acceptedTimeRange()

		// Process all pending blocks
		// TODO: Improve the performance of this by tracking dependencies between pending blocks
		for (const [timestamp, blocks] of this._pendingBlocks) {
			// Remove old blocks
			if (timestamp < min) {
				this._pendingBlocks.delete(timestamp)
				continue
			}

			// Try block and remove it if it was accepted
			const newBlocks = blocks.filter((block) => {
				try {
					this.add(block)
					return false
				} catch {
					return true
				}
			})

			// Update pending blocks
			if (newBlocks.length === 0) {
				this._pendingBlocks.delete(timestamp)
			} else {
				this._pendingBlocks.set(timestamp, newBlocks)
			}
		}
	}

	private addPending(block: Block): void {
		const pending = this._pendingBlocks.get(block.timestamp) ?? []
		pending.push(block)
		this._pendingBlocks.set(block.timestamp, pending)
	}

	// Validate all the things about the block that don't require access to the store
	private validateBlockFormat(block: Block): void {
		// Validate timestamp
		const [min, max] = this.acceptedTimeRange()
		if (block.timestamp < min || block.timestamp > max) {
			throw new Error(`Block timestamp ${block.timestamp} is outside of accepted range [${min}, ${max}]`)
		}

		// Validate signature
		// TODO: Validate signature
	}

	private validateGenesisBlock(block: Block): NodeID {
		// Decode block data to get join request
		const joinRequest = unpack(block.data) as { node: NodeID }
		return joinRequest.node
	}

	private validateNormalBlock(block: Block): NodeID {
		// Check if all parents exist
		for (const parent of block.parents) {
			if (!this.hasBlock(parent)) {
				this.addPending(block)
				throw new Error(`Parent block ${bytesToString(parent)} does not exist, block added to pending`)
			}
		}

		// Get source data
		const data = this.getBlockData(block.parents[0])!
		return data.node
	}
}
