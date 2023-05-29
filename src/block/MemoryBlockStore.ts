import { HashFn, SignatureVerifierFn } from '../crypto/Types'
import { Ref } from '../Utility'
import { BlockStore, BlockData, Cursor, Block } from './BlockStore'

export type NodeID = Uint8Array

export class MemoryBlockStore extends BlockStore {
	private readonly _blocks = new Map<Ref<Block>, BlockData>()
	private readonly _nodeIndex = new Map<NodeID, Ref<Block>[]>()

	public constructor(
		hash: HashFn,
		verify: SignatureVerifierFn,
	) {
		super(hash, verify)
	}

	public getHeads(): Ref<Block>[] {
		return [...this._nodeIndex.entries()].map(([, blocks]) => blocks[blocks.length - 1])
	}

	public hasBlock(id: Ref<Block>): boolean {
		return this._blocks.has(id)
	}

	public getBlockData(id: Ref<Block>): BlockData | undefined {
		return this._blocks.get(id)
	}

	public getBlocks(ids: Ref<Block>[]): Block[] {
		return ids.flatMap((id) => this._blocks.get(id)?.block ?? [])
	}

	public getBlockByIndex(node: NodeID, index: number): Ref<Block> | undefined {
		const blocks = this._nodeIndex.get(node)
		if (blocks === undefined) {
			return undefined
		}

		return blocks[index]
	}

	public getBlockRange(node: NodeID, start?: number, end?: number): Ref<Block>[] {
		const blocks = this._nodeIndex.get(node)
		if (blocks === undefined) {
			return []
		}

		return blocks.slice(start, end)
	}

	public getCursor(): Cursor {
		return new Map([...this._nodeIndex.entries()].map(([node, blocks]) => [node, blocks.length]))
	}

	protected addBlockInner(id: Ref<Block>, node: NodeID, block: Block): void {
		const blocks = this._nodeIndex.get(node) ?? []
		this._blocks.set(id, { block, node, index: blocks.length })
		blocks.push(id)
		this._nodeIndex.set(node, blocks)
	}
}
