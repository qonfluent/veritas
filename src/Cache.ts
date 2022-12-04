import assert from "assert"

export type CacheDesc = {
	widthBits: number
	rowCount: number
	ways: number
	latency: number
}

export type Address = number

export enum CacheOp {
	Read,
	Write,
}

export type CacheReadInput = {
	op: CacheOp.Read
	address: Address
	widthBytes: number
}

export type CacheWriteInput = {
	op: CacheOp.Write
	address: Address
	data: Uint8Array
}

export type CacheInput = CacheReadInput | CacheWriteInput

export type CacheReadOutput = {
	op: CacheOp.Read
	data?: Uint8Array
}

export type CacheEvictionData = {
	address: Address
	data: Uint8Array
}

export type CacheWriteOutput = {
	op: CacheOp.Write
	evicted?: CacheEvictionData
}

export type CacheOutput = CacheReadOutput | CacheWriteOutput

export type CacheLine = {
	valid: boolean
	tag: number
	data: Uint8Array
}

export class CacheUnit {
	private readonly _ways: CacheLine[][] = []
	private readonly _rowBits: number
	private readonly _results: (CacheOutput | undefined)[] = []

	public constructor(
		private readonly _desc: CacheDesc,
	) {
		assert(this._desc.widthBits % 8 === 0)

		// Init cache data
		for (let way = 0; way < _desc.ways; way++) {
			this._ways.push([])
			for (let row = 0; row < _desc.rowCount; row++) {
				this._ways[way].push({ valid: false, tag: 0, data: new Uint8Array([]) })
			}
		}

		// Init params
		this._rowBits = Math.ceil(Math.log2(_desc.rowCount))
	}

	public step(input?: CacheInput): CacheOutput | undefined {
		// TODO: Parametrize this function, allow for more instances
		if (input !== undefined) {
			// TODO: Use a hash function on the row index?
			const rowIndex = input.address & ~(0xFFFFFFFF << this._rowBits)
			const tagIndex = input.address >> this._rowBits

			const hitWayIndex = this._ways.findIndex((way) => way[rowIndex].valid && way[rowIndex].tag === tagIndex)

			let result: CacheOutput
			switch (input.op) {
				case CacheOp.Read: {
					// Read operation
					
					if (hitWayIndex === -1) {
						result = { op: CacheOp.Read }
						break
					} else {
						result = {
							op: CacheOp.Read,
							data: this._ways[hitWayIndex][rowIndex].data,
						}
						break
					}
				}
				case CacheOp.Write: {
					// Write operation, ensure value is valid
					assert(input.data.length * 8 === this._desc.widthBits)

					// Search for hit
					if (hitWayIndex !== -1) {
						// Update row
						this._ways[hitWayIndex][rowIndex].data = input.data

						result = { op: CacheOp.Write }
						break
					}

					// Find empty way
					const invalidWayIndex = this._ways.findIndex((way) => !way[rowIndex].valid)
					if (invalidWayIndex === -1) {
						// All ways hit, we have to evict. Start by picking the evicted member
						// TODO: Use something like LRU instead
						const evictWay = Math.floor(Math.random() * this._ways.length)
						const evictAddr = (this._ways[evictWay][rowIndex].tag << this._rowBits) | rowIndex
						const evictData = this._ways[evictWay][rowIndex].data
						
						// Write the data
						this._ways[evictWay][rowIndex].tag = tagIndex
						this._ways[evictWay][rowIndex].data = input.data

						// Return the evicted data
						result = {
							op: CacheOp.Write,
							evicted: {
								address: evictAddr,
								data: evictData,
							}
						}

						break
					} else {
						// Write the data to the invalid way
						this._ways[invalidWayIndex][rowIndex] = {
							valid: true,
							tag: tagIndex,
							data: input.data,
						}

						result = { op: CacheOp.Write }
						break
					}	
				}	
			}

			this._results[this._desc.latency] = result
		}

		const [result] = this._results.splice(0, 1)
		return result
	}
}
