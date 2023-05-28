import { BlockID, Block } from './Block'
import { BlockStore, BlockData, Cursor } from './BlockStore'
import { NodeID } from './Node'

export class MemoryBlockStore extends BlockStore {
	private readonly _blocks = new Map<BlockID, BlockData>()
	private readonly _nodeIndex = new Map<NodeID, BlockID[]>()

	public constructor(
		blockId: (block: Block) => BlockID,
	) {
		super(blockId)
	}

	public getHeads(): BlockID[] {
		return [...this._nodeIndex.entries()].map(([, blocks]) => blocks[blocks.length - 1])
	}

	public hasBlock(id: BlockID): boolean {
		return this._blocks.has(id)
	}

	public getBlockData(id: BlockID): BlockData | undefined {
		return this._blocks.get(id)
	}

	public getCursor(): Cursor {
		return new Map([...this._nodeIndex.entries()].map(([node, blocks]) => [node, blocks.length]))
	}

	protected addBlockInner(id: BlockID, parent: NodeID, block: Block): void {
		const blocks = this._nodeIndex.get(parent) ?? []
		this._blocks.set(id, new BlockData(block, parent, blocks.length))
		blocks.push(id)
		this._nodeIndex.set(parent, blocks)
	}
}
