import { CacheDesc } from "./Cache"
import { DecoderBlockDesc, DecoderBlockUnit } from "./DecoderBlock"
import { DecoderTree } from "./DecoderTree"
import { ArgMode, ModeSizeMap, OperationDesc } from "./Operation"

export type CoreDesc = {
	decoders: DecoderBlockDesc[]
	l2cache: CacheDesc
}

export type CoreInput = {}
export type CoreOutput = {}

export class CoreUnit {
	private readonly _decoders: DecoderBlockUnit[]

	public constructor(
		private readonly _desc: CoreDesc,
	) {
		this._decoders = _desc.decoders.map((desc) => new DecoderBlockUnit(desc))
	}

	public step(input: CoreInput): CoreOutput {
		return {}
	}
}
