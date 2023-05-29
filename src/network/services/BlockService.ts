import { Ref } from '../Ref'
import { IService } from '../Service'
import { Identity } from './IdentityService'

export type Block = {
	parents: Ref<Block>[]
	body: Uint8Array
	signature: Uint8Array
}

export type BlockPushMessage = {
	// The blocks to push
	blocks: Block[]
}

export type BlockPullMessage = {
	// The cursor to pull after
	cursor: Map<Ref<Identity>, number>
}

export interface IBlockService extends IService {
	// Get the local blocks
	get localBlocks(): Block[]

	// Add a local block
	addLocalBlock(block: Block, parents?: Ref<Block>[]): void

	// Handle a new block being discovered
	onBlock(handler: (block: Block, source: Ref<Identity>) => void): void
}
