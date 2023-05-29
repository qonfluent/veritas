import { Block, BlockStore, Cursor } from '../../block/BlockStore'
import { IService } from '../Service'

export type BlockPushMessage = {
	// The blocks to push
	blocks: Block[]
}

export type BlockPullMessage = {
	// The cursor to pull after
	cursor: Cursor
}

export interface IBlockService extends IService {
	// Get the block store
	get store(): BlockStore
}
