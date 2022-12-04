import assert from "assert"
import { CacheDesc, CacheEvictionData, CacheInput, CacheOp, CacheReadInput, CacheUnit, CacheWriteInput } from "./Cache"
import { DecoderBlockDesc, DecoderBlockUnit } from "./DecoderBlock"

export type CoreDesc = {
	decoders: DecoderBlockDesc[]
	l2cache: CacheDesc
}

export type CoreInput = {
	cacheWrite?: CacheInput
}

export type CoreOutput = {
	l3Cache?: CacheInput
}

export class CoreUnit {
	private readonly _decoders: {
		decoder: DecoderBlockUnit
		missResponse?: CacheWriteInput
		stall: boolean
	}[]
	private readonly _l2Cache: CacheUnit
	private readonly _addressShiftBits: number
	private readonly _l3Buffer: CacheInput[] = []

	public constructor(
		private readonly _desc: CoreDesc,
	) {
		this._decoders = _desc.decoders.map((desc) => ({ decoder: new DecoderBlockUnit(desc), stall: false }))
		this._l2Cache = new CacheUnit(_desc.l2cache)
		this._addressShiftBits = Math.ceil(Math.log2(Math.ceil(_desc.l2cache.widthBits / 8)))
	}

	public step(input?: CoreInput): CoreOutput | undefined {
		// Update cache, generating potential evict
		const mainEvict = input?.cacheWrite === undefined ? undefined : this.handleCacheWrite(input.cacheWrite)
		assert(mainEvict !== undefined)
		assert(mainEvict.op === CacheOp.Write)

		// Update each decoder
		const results = this._decoders.map(({ decoder, missResponse, stall }) => stall ? undefined : decoder.step({ cacheWrite: missResponse }))

		// TODO: Perform dispatch of decoded operations here!

		// Handle evictions
		const resultEvicts: CacheEvictionData[] = results.flatMap((evict) => {
			if (evict?.cacheEvict !== undefined) {
				const result = this._l2Cache.step(evict.cacheEvict)
				assert(result !== undefined)
				assert(result.op === CacheOp.Write)

				return result.evicted ? [result.evicted] : []
			}

			return []
		})

		// Handle misses
		const resultMisses: CacheReadInput[] = this._decoders.flatMap((_, i) => {
			const cacheMiss = results[i]?.cacheMiss
			if (cacheMiss !== undefined) {
				// Read L2
				const response = this._l2Cache.step()
				assert(response !== undefined)
				assert(response.op === CacheOp.Read)

				// Handle L2 miss
				if (response.data === undefined) {
					this._decoders[i].missResponse = undefined
					this._decoders[i].stall = true
					return [{ op: CacheOp.Read, address: cacheMiss.address, widthBytes: cacheMiss.widthBytes }]
				}

				this._decoders[i].missResponse = { op: CacheOp.Write, address: cacheMiss.address, data: response.data }
			} else {
				this._decoders[i].missResponse = undefined
			}

			return []
		})

		// Merge evicts and misses onto pending L3 op buffer
		const l3Writes: CacheInput[] = resultEvicts.map(({ address, data }) => ({ op: CacheOp.Write, address, data }))
		this._l3Buffer.push(...l3Writes)
		this._l3Buffer.push(...resultMisses)

		// Return
		const [cacheResult] = this._l3Buffer.splice(0, 1)
		return { l3Cache: cacheResult }
	}

	private handleCacheWrite(input: CacheInput): CacheWriteInput | undefined {
		assert(input.op === CacheOp.Write)

		// Step the cache with the input
		const result = this._l2Cache.step(input)
		assert(result !== undefined)
		assert(result.op === CacheOp.Write)

		return result.evicted === undefined ? undefined : { op: CacheOp.Write, address: result.evicted.address, data: result.evicted.data }
	}
}
