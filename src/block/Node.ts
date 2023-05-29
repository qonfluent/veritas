import { Block } from './Block'
import { Cursor, BlockStore } from './BlockStore'

export type NodeID = Uint8Array

export type Message = {
	type: 'push',
	blocks: Block[],
} | {
	type: 'pull',
	cursor: Cursor,
}

export class Node {
	public constructor(
		private readonly _id: NodeID,
		private readonly _store: BlockStore,
	) {}

	public step(msg: Message): Message[] {
		switch (msg.type) {
			case 'push': {
				// Add blocks
				for (const block of msg.blocks) {
					this._store.add(block)
				}

				return []
			}
			case 'pull': {
				// Get blocks
				const blocks = this._store.getDelta(msg.cursor)

				// Return message
				return [{
					type: 'push',
					blocks,
				}]
			}
		}
	}
}
