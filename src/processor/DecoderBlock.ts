import assert from "assert"
import { CacheDesc, CacheUnit, CacheOp, CacheInput, Address, CacheWriteInput, CacheReadInput } from "./Cache"
import { DecoderDesc, Instruction, DecoderUnit } from "./Decoder"
import { ModeSizeMap } from "./Operation"

export type DecoderBlockDesc = {
	icache: CacheDesc
	decoder: DecoderDesc
}

export type DecoderBlockInput = {
	cacheWrite?: CacheInput
}

export type DecoderBlockOutput = {
	decoded?: Instruction
	cacheMiss?: CacheReadInput
	cacheEvict?: CacheWriteInput
}

export class DecoderBlockUnit {
	private _ip: number = 0
	private _shifter: Uint8Array = new Uint8Array()
	private _cacheWidthBytes: number
	private _instructionWidthBytes: number
	private _ipShiftBits: number
	private readonly _icache: CacheUnit
	private readonly _decoder: DecoderUnit

	public constructor(
		private readonly _desc: DecoderBlockDesc,
		modeSizes: ModeSizeMap,
	) {
		assert(_desc.icache.widthBits % 8 === 0)

		this._cacheWidthBytes = _desc.icache.widthBits / 8
		this._ipShiftBits = Math.ceil(Math.log2(this._cacheWidthBytes))
		this._icache = new CacheUnit(_desc.icache)
		this._decoder = new DecoderUnit(_desc.decoder, modeSizes)
		this._instructionWidthBytes = this._decoder.getMaxInstructionWidth()
	}

	public get ip(): Address {
		return this._ip
	}

	public step(input?: DecoderBlockInput): DecoderBlockOutput | undefined {
		// Update cache, generating potential evict
		const cacheEvict = input?.cacheWrite === undefined ? undefined : this.handleCacheWrite(input.cacheWrite)

		// Update shifter, which might miss in cache
		const cacheMiss = this.updateShifter()
		if (cacheMiss === undefined) {
			// If we can, decode and update IP and shifter
			const decoded = this._decoder.step({ instruction: this._shifter.slice(0, this._cacheWidthBytes) })
			this._ip += decoded.shift
			this._shifter = this._shifter.slice(decoded.shift)

			return { decoded: decoded.decoded, cacheMiss, cacheEvict }
		}

		return { cacheMiss, cacheEvict }
	}

	private handleCacheWrite(input: CacheInput): CacheWriteInput | undefined {
		assert(input.op === CacheOp.Write)
		assert(input.address === (this._ip & (0xFFFFFFFF << this._ipShiftBits)))

		// Step the cache with the input
		const result = this._icache.step(input)
		assert(result !== undefined)
		assert(result.op === CacheOp.Write)

		return result.evicted === undefined ? undefined : { op: CacheOp.Write, address: result.evicted.address, data: result.evicted.data }
	}

	// Updates shifter if it has enough space for another cache line. Might miss and cause stall
	private updateShifter(): CacheReadInput | undefined {
		if (this._shifter.length < this._cacheWidthBytes) {
			// Read next line from icache
			// TODO: Handle latency, wider shifter?
			const read = this._icache.step({ op: CacheOp.Read, address: this._ip >> this._ipShiftBits, widthBytes: this._cacheWidthBytes })
			assert(read !== undefined && read.op === CacheOp.Read)

			// Handle icache miss
			if (read.data === undefined) {
				// Mask out lower bits of IP to get actual read address
				const maskedIp = this._ip & (0xFFFFFFFF << this._ipShiftBits)
				return { op: CacheOp.Read, address: maskedIp, widthBytes: this._cacheWidthBytes }
			}

			this._shifter = new Uint8Array([...this._shifter, ...read.data])
		}

		if (this._shifter.length < this._instructionWidthBytes) {
			throw new Error('Oof')
		}

		return undefined
	}
}
