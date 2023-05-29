import { TimeInstant } from '../Utility'

export type BlockID = Uint8Array

export class Block {
	public constructor(
		public readonly timestamp: TimeInstant,
		public readonly parents: BlockID[],
		public readonly data: Uint8Array,
		public readonly signature: Uint8Array,
	) {}
}
