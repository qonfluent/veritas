import assert from "assert"

export type CacheDesc = {
	widthBits: number
	rowCount: number
	ways: number
}

export type Address = number

export type CacheInput = {
	write: false
	address: Address
} | {
	write: true
	address: Address
	data: Uint8Array
}

export type CacheOutput = {
	write: false
	data?: Uint8Array
} | {
	write: true
	evicted?: {
		address: Address
		data: Uint8Array
	}
}

export type CacheLine = {
	valid: boolean
	tag: number
	data: Uint8Array
}

export class CacheUnit {
	private readonly _ways: CacheLine[][] = []
	private readonly _rowBits: number

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

			if (input.write) {
				// Write operation, ensure value is valid
				assert(input.data.length * 8 === this._desc.widthBits)

				// Search for hit
				const hitWayIndex = this._ways.findIndex((way) => way[rowIndex].valid && way[rowIndex].tag === tagIndex)
				if (hitWayIndex !== -1) {
					// Update row
					this._ways[hitWayIndex][rowIndex].data = input.data

					return { write: true }
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
					return {
						write: true,
						evicted: {
							address: evictAddr,
							data: evictData,
						}
					}
				} else {
					// Write the data to the invalid way
					this._ways[invalidWayIndex][rowIndex] = {
						valid: true,
						tag: tagIndex,
						data: input.data,
					}
					
					return { write: true }
				}
			} else {
				// Read operation
				const hitIndex = this._ways.findIndex((way) => way[rowIndex].valid && way[rowIndex].tag === tagIndex)
				if (hitIndex === -1) {
					return {
						write: false,
					}
				} else {
					return {
						write: false,
						data: this._ways[hitIndex][rowIndex].data,
					}
				}
			}
		}

		return undefined
	}
}
