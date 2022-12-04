import assert from "assert"
import { CacheDesc, CacheInput, CacheOp, CacheUnit } from "./Cache"
import { DecoderBlockDesc, DecoderBlockUnit } from "./DecoderBlock"

export type CoreDesc = {
	decoders: DecoderBlockDesc[]
	l2cache: CacheDesc
}

export type CoreInput = {
	l2Cache?: CacheInput
}
export type CoreOutput = {
	l3Cache?: CacheInput
}

export enum CoreState {
	Init,
	Exec,
	Stall,
}

export class CoreUnit {
	private readonly _decoders: DecoderBlockUnit[]
	private readonly _l2Cache: CacheUnit
	private _state: CoreState
	private readonly _addressShiftBits: number

	public constructor(
		private readonly _desc: CoreDesc,
	) {
		this._decoders = _desc.decoders.map((desc) => new DecoderBlockUnit(desc))
		this._l2Cache = new CacheUnit(_desc.l2cache)
		this._state = CoreState.Init
		this._addressShiftBits = Math.ceil(Math.log2(Math.ceil(_desc.l2cache.widthBits / 8)))
	}

	public step(input?: CoreInput): CoreOutput | undefined {
		switch (this._state) {
			case CoreState.Init: {
				// Step each decoder and generate per-decoder outputs
				const result: (CacheInput | undefined)[] = this._decoders.map((decoder) => {
					// Step decoder
					const init = decoder.step()

					// Validate init result
					assert(init !== undefined)
					assert(init.l2Cache !== undefined)
					assert(init.decoded === undefined)

					return this.updateL2(init.l2Cache, decoder)
				})

				// Merge cache updates

				// Return
				this._state = CoreState.Exec

				return {}
			}
			case CoreState.Exec: {
				const result: (CacheInput | undefined)[] = this._decoders.map((decoder) => {
					const result = decoder.step()
					return result?.l2Cache
				})

				return undefined
			}
			case CoreState.Stall: {
				return undefined
			}
		}
	}

	private updateL2(update: CacheInput, decoder: DecoderBlockUnit): CacheInput | undefined {
		assert(update.op === CacheOp.Read)

		// Perform L2 read
		const read = this._l2Cache.step({ op: CacheOp.Read, address: update.address >> this._addressShiftBits, widthBytes: update.widthBytes })
		assert(read !== undefined)
		assert(read.op === CacheOp.Read)

		// Handle miss
		if (read.data === undefined) {
			this._state = CoreState.Stall
			return { op: CacheOp.Read, address: update.address, widthBytes: update.widthBytes }
		}

		// Write back to L1
		const l1Write = decoder.step({ l2Cache: { op: CacheOp.Write, address: update.address, data: read.data }})
		assert(l1Write !== undefined)
		
		// Handle displacement
		// TODO: Handle this earlier by including the evicted line with the read request
		if (l1Write.l2Cache) {
			assert(l1Write.l2Cache.op === CacheOp.Write)
			const l2Write = this._l2Cache.step(l1Write.l2Cache)
			assert(l2Write !== undefined)
			assert(l2Write.op === CacheOp.Write)

			return l2Write.evicted === undefined ? undefined : { op: CacheOp.Write, address: l2Write.evicted.address, data: l2Write.evicted.data }
		}

		return undefined
	}
}
