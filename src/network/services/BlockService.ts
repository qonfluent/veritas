import { Block, Cursor } from '../../block/BlockStore'
import { Ref } from '../../Utility'
import { IService } from '../Service'
import { Identity } from './IdentityService'

export type BlockPushMessage = {
	// The blocks to push
	blocks: Block[]
}

export type BlockPullMessage = {
	// The cursor to pull after
	cursor: Cursor
}

export interface IBlockService extends IService {
	// Get the local blocks
	get localBlocks(): Block[]

	// Add a local block
	addLocalBlock(block: Block, parents?: Ref<Block>[]): void

	// Handle a new block being discovered
	onBlock(handler: (block: Block, source: Ref<Identity>) => void): void
}
