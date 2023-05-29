import { pack, unpack } from 'msgpackr'
import { HashFn, SignatureVerifierFn } from '../crypto/Types'
import { Identity } from '../network/services/IdentityService'
import { bytesToString, Ref } from '../Utility'

export type Cursor = Map<Ref<Identity>, number>

export type Block = {
	parents: Ref<Block>[]
	data: Uint8Array
	signature: Uint8Array
}

export type JoinRequest = {
	// The identity of the node
	identity: Identity
}

export type BlockData = {
	block: Block
	node: Ref<Identity>
	index: number
}

export abstract class BlockStore {
	protected _latestCompleteRow = -1

	public constructor(
		protected readonly _hash: HashFn,
		protected readonly _verify: SignatureVerifierFn,
		protected readonly _validateJoin: (joinRequest: JoinRequest) => void,
	) {}

	public abstract getCursor(): Cursor
	public abstract getHeads(): Ref<Block>[]
	public abstract hasBlock(id: Ref<Block>): boolean
	public abstract getBlockData(id: Ref<Block>): BlockData | undefined
	public abstract getBlocks(blocks: Ref<Block>[]): Block[]
	public abstract getBlockByIndex(node: Ref<Identity>, index: number): Ref<Block> | undefined
	public abstract getBlockRange(node: Ref<Identity>, start?: number, end?: number): Ref<Block>[]
	protected abstract addBlockInner(id: Ref<Block>, parent: Ref<Identity>, block: Block): void

	public add(block: Block): Ref<Block> {
		// Get block ID and now
		const now = Date.now()
		const id = this._hash(pack(block))

		// Check if block already exists
		if (this.hasBlock(id)) {
			return id
		}

		// Validate signature
		if (!this._verify(block.signature, block.data, block.signature)) {
			throw new Error('Block has invalid signature')
		}

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
		const blockIDs: Ref<Block>[] = []
		const visited = new Set<Ref<Block>>()

		const visit = (id: Ref<Block>): void => {
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

	public getLatestCompleteRow(threshold: number): number {
		// Get cursor
		const cursor = this.getCursor()

		// Find the max index
		const maxIndex = [...cursor.values()].reduce((max, index) => Math.max(max, index), 0)

		// Get the set of nodes
		const nodes = [...cursor.keys()]

		// Calculate the minimum number of nodes that must be in the row
		const minCount = Math.ceil(nodes.length * threshold)

		// Scan backswards until we find a row that is complete
		for (let i = maxIndex; i >= this._latestCompleteRow; i--) {
			// Check if this row is complete
			const rowCount = nodes.reduce((count, node) => count + (this.getBlockByIndex(node, i) === undefined ? 0 : 1), 0)
			if (rowCount >= minCount) {
				return i
			}
		}

		// No complete row found
		return this._latestCompleteRow
	}

	private validateGenesisBlock(block: Block): Ref<Identity> {
		// Decode block data to get join request
		const joinRequest = unpack(block.data) as JoinRequest

		// Validate join request
		this._validateJoin(joinRequest)

		return joinRequest.identity.id
	}

	private validateNormalBlock(block: Block): Ref<Identity> {
		// Check if all parents exist
		for (const parent of block.parents) {
			if (!this.hasBlock(parent)) {
				throw new Error(`Parent block ${bytesToString(parent)} does not exist`)
			}
		}

		// Get source data
		const data = this.getBlockData(block.parents[0])!
		return data.node
	}
}
