import assert from "assert"
import { CacheDesc, CacheEvictionData, CacheInput, CacheOp, CacheReadInput, CacheUnit, CacheWriteInput } from "./Cache"
import { DecoderBlockDesc, DecoderBlockUnit } from "./DecoderBlock"
import { DistributorDesc, DistributorUnit } from "./Distributor"
import { ModeSizeMap } from "./Operation"

export type CoreDesc = {
	modeSizes: ModeSizeMap
	decoders: DecoderBlockDesc[]
	l2cache: CacheDesc
	distributor: DistributorDesc
}

export type CoreInput = {
	cacheWrite?: CacheInput
}

export type CoreOutput = {
	l3Cache?: CacheInput
}

export type CoreInfo = {
	decoders: {
		ip: number
	}[]
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
	private readonly _distributor: DistributorUnit

	public constructor(
		private readonly _desc: CoreDesc,
	) {
		this._decoders = _desc.decoders.map((desc) => ({ decoder: new DecoderBlockUnit(desc, _desc.modeSizes), stall: false }))
		this._l2Cache = new CacheUnit(_desc.l2cache)
		this._addressShiftBits = Math.ceil(Math.log2(Math.ceil(_desc.l2cache.widthBits / 8)))
		this._distributor = new DistributorUnit(_desc.distributor)
	}

	public get info(): CoreInfo {
		return {
			decoders: this._decoders.map(({ decoder }) => {
				return {
					ip: decoder.ip,
				}
			}),
		}
	}

	public step(input?: CoreInput): CoreOutput | undefined {
		// Update cache, generating potential evict
		if (input?.cacheWrite !== undefined) {
			const writeEvict = this.handleCacheWrite(input.cacheWrite)
			if (writeEvict !== undefined) {
				this._l3Buffer.push(writeEvict)
			}
		}

		// Update each decoder
		const decoded = this._decoders.map(({ decoder, missResponse, stall }) => stall ? undefined : decoder.step({ cacheWrite: missResponse }))

		// Perform operations
		this._distributor.step(decoded.map((x) => x?.decoded === undefined ? undefined : x.decoded))

		// Handle evictions
		const resultEvicts: CacheEvictionData[] = decoded.flatMap((evict) => {
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
			const cacheMiss = decoded[i]?.cacheMiss
			this._decoders[i].missResponse = undefined
			if (cacheMiss === undefined) {
				return []
			}

			// Read L2
			const response = this._l2Cache.step({ op: CacheOp.Read, address: cacheMiss.address >> this._addressShiftBits, widthBytes: cacheMiss.widthBytes })
			assert(response !== undefined)
			assert(response.op === CacheOp.Read)

			// Handle L2 miss
			if (response.data === undefined) {
				this._decoders[i].stall = true
				return [{ op: CacheOp.Read, address: cacheMiss.address, widthBytes: cacheMiss.widthBytes }]
			}

			this._decoders[i].missResponse = { op: CacheOp.Write, address: cacheMiss.address, data: response.data }
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
