import crypto from 'crypto'

export type BlockID = string
export type NodeID = string
export type Timestamp = number
export type Signature = Uint8Array

export type Block = {
	timestamp: Timestamp
	parents: BlockID[]
	data: Uint8Array
	signature: Signature
}

export enum MessageType {
	GetHeads,
	AddBlock,
}

export type Message = {
	tag: MessageType.GetHeads
	issuer: NodeID
	audience: NodeID
} | {
	tag: MessageType.AddBlock
	issuer: NodeID
	audience: NodeID
	block: Block
}

export type Response = {
	tag: MessageType.GetHeads
	issuer: NodeID
	audience: NodeID
	heads: Map<NodeID, BlockID>
}

export class Node {
	private readonly _id: NodeID
	private readonly _blocks: Map<BlockID, Block> = new Map()
	private readonly _heads: Map<NodeID, BlockID> = new Map()
	private readonly _inverseHeads: Map<BlockID, NodeID> = new Map()
	private readonly _sources: Map<BlockID, NodeID> = new Map()

	public constructor() {
		this._id = `test-node-${Math.floor(Math.random() * 1000000)}`
	}

	public get id(): NodeID {
		return this._id
	}

	public step(msgs: Message[]): Response[] {
		const response: Response[] = []
		const sources: NodeID[] = []

		// Process all messages
		for (const msg of msgs) {
			// Validate message
			if (msg.issuer !== this.id) {
				throw new Error(`Invalid message issuer: ${msg.issuer}`)
			}

			// Handle message
			response.push(...this.handleMessage(msg))

			// Add source
			sources.push(msg.issuer)
		}

		// Add new block
		this.addBlock({
			timestamp: Date.now(),
			parents: [this._heads.get(this.id) ?? this.id, ...sources],
			data: new Uint8Array(),
			signature: new Uint8Array(),
		})

		return response
	}

	private getBlockId(block: Block): BlockID {
		const data = new TextEncoder().encode(JSON.stringify(block))
		const hash = crypto.createHash('sha256').update(data).digest()
		return `sha256-${hash.toString('hex')}`
	}

	private addBlock(block: Block): void {
		const blockId = this.getBlockId(block)
		this._blocks.set(blockId, block)
		this._heads.set(this.id, blockId)
		this._inverseHeads.set(blockId, this.id)
		this._sources.set(blockId, this.id)
	}

	private handleMessage(msg: Message): Response[] {
		const response: Response[] = []
		
		// Process message
		switch (msg.tag) {
			case MessageType.GetHeads: {
				response.push({
					tag: MessageType.GetHeads,
					issuer: this.id,
					audience: msg.issuer,
					heads: this._heads,
				})

				break
			}
			case MessageType.AddBlock: {
				// Get block ID
				const blockId = this.getBlockId(msg.block)
				
				// Validate block
				if (msg.block.parents.length === 0) {
					throw new Error(`Invalid block: ${msg.block}`)
				}

				// Validate block parents, starting with the source head
				const source = this._inverseHeads.get(msg.block.parents[0])
				if (source === undefined) {
					throw new Error(`Invalid block parent: ${msg.block.parents[0]}`)
				}

				// Validate block parents, continuing with the rest of the parents
				for (const parent of msg.block.parents.slice(1)) {
					if (!this._sources.has(parent)) {
						throw new Error(`Invalid block parent: ${parent}`)
					}
				}

				// Validate block signature
				this.validateSignature(msg.block)

				// Add block
				this.addBlock(msg.block)

				break
			}
		}

		return response
	}

	private validateSignature(block: Block): void {
		// TODO
	}
}

describe('What', () => {
	it('should work', async () => {
		const node = new Node()
	})
})
