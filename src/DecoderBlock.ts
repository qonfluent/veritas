import assert from "assert"
import { CacheDesc, CacheUnit, CacheOp, CacheInput, Address } from "./Cache"
import { DecoderDesc, Instruction, DecoderUnit } from "./Decoder"

export type DecoderBlockDesc = {
	icache: CacheDesc
	decoder: DecoderDesc
}

export type DecoderBlockInput = {
	l2Cache?: CacheInput
}

export type DecoderBlockOutput = {
	decoded?: Instruction
	l2Cache?: CacheInput
}

export enum DecoderBlockState {
	Init,
	Decode,
	Stall,
}

export class DecoderBlockUnit {
	private _ip: number = 0
	private _shifter: Uint8Array = new Uint8Array()
	private _state: DecoderBlockState = DecoderBlockState.Init
	private _cacheWidthBytes: number
	private _ipShiftBits: number
	private readonly _icache: CacheUnit
	private readonly _decoder: DecoderUnit

	public constructor(
		private readonly _desc: DecoderBlockDesc,
	) {
		assert(_desc.icache.widthBits % 8 === 0)

		this._cacheWidthBytes = _desc.icache.widthBits / 8
		this._ipShiftBits = Math.ceil(Math.log2(this._cacheWidthBytes))
		this._icache = new CacheUnit(_desc.icache)
		this._decoder = new DecoderUnit(_desc.decoder)
	}

	public get state(): DecoderBlockState {
		return this._state
	}

	public get ip(): Address {
		return this._ip
	}

	public step(input?: DecoderBlockInput): DecoderBlockOutput | undefined {
		// TODO: Split up the shifter refill from the decode, so we can do both at once and simplify the core's step cycle
		switch (this._state) {
			case DecoderBlockState.Init: {
				// Do initial icache read
				// TODO: Handle latency here
				const initRead = this._icache.step({ op: CacheOp.Read, address: this._ip >> this._ipShiftBits, widthBytes: this._cacheWidthBytes })
				assert(initRead !== undefined && initRead.op === CacheOp.Read)

				// Handle icache miss
				if (initRead.data === undefined) {
					return this.handleInstructionCacheMiss()
				}

				// Update shifter
				this._shifter = initRead.data

				this._state = DecoderBlockState.Decode

				return undefined
			}
			case DecoderBlockState.Decode: {
				// Decode instruction
				// TODO: handle latency here
				const decoded = this._decoder.step({ instruction: this._shifter })
				this._shifter = this._shifter.slice(decoded.shift)
				this._ip += decoded.shift

				// Update shifter if needed. Might stall.
				const shifterUpdate = this.updateShifter()
				return shifterUpdate === true ? { decoded: decoded.decoded } : { decoded: decoded.decoded, ...shifterUpdate }
			}
			case DecoderBlockState.Stall: {
				// Validate input
				assert(input !== undefined)
				assert(input.l2Cache !== undefined)
				assert(input.l2Cache.op === CacheOp.Write)
				assert(input.l2Cache.address === (this._ip & (0xFFFFFFFF << this._ipShiftBits)))

				// Step the cache with the input
				const result = this._icache.step(input.l2Cache)
				assert(result !== undefined)
				assert(result.op === CacheOp.Write)

				const updateResult = this.updateShifter()
				assert(updateResult === true)
				
				this._state = DecoderBlockState.Decode

				return result.evicted === undefined ? {} : { l2Cache: { op: CacheOp.Write, address: result.evicted.address, data: result.evicted.data } }
			}
		}
	}

	// Updates shifter if it has enough space for another cache line
	// Returns decoder block output on cache miss, true on success
	private updateShifter(): DecoderBlockOutput | true {
		if (this._shifter.length < this._cacheWidthBytes) {
			// Read next line from icache
			// TODO: Handle latency, wider shifter?
			const read = this._icache.step({ op: CacheOp.Read, address: this._ip >> this._ipShiftBits, widthBytes: this._cacheWidthBytes })
			assert(read !== undefined && read.op === CacheOp.Read)

			// Handle icache miss
			if (read.data === undefined) {
				return this.handleInstructionCacheMiss()
			}

			this._shifter = new Uint8Array([...this._shifter, ...read.data])
		}

		return true
	}

	// Handles an instruction cache miss
	private handleInstructionCacheMiss(): DecoderBlockOutput {
		// Update the state to stall
		// TODO: Allow instructions to keep decoding until the buffer runs dry
		this._state = DecoderBlockState.Stall

		// Mask out lower bits of IP to get actual read address
		const maskedIp = this._ip & (0xFFFFFFFF << this._ipShiftBits)
		return { l2Cache: { op: CacheOp.Read, address: maskedIp, widthBytes: this._cacheWidthBytes } }
	}
}
