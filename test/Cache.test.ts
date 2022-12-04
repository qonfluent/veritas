import assert from "assert"
import { CacheOp, CacheUnit } from "../src/Cache"

const TEST_DATA_COUNT = 10

describe('Cache', () => {
	let cache: CacheUnit

	const testData = [...Array(TEST_DATA_COUNT)].map((_, i) => new Uint8Array([i, Math.floor(Math.random() * 256), 0, 0]))

	it('Can be created', () => {
		cache = new CacheUnit({
			widthBits: 32,
			rowCount: 4,
			ways: 1,
			latency: 0,
		})
	})

	it('Can be written to and read from', () => {
		const write = cache.step({
			op: CacheOp.Write,
			address: 0,
			data: testData[0],
		})

		expect(write).toEqual({ op: CacheOp.Write })

		const read = cache.step({
			op: CacheOp.Read,
			address: 0,
			widthBytes: testData[1].length,
		})

		expect(read).toEqual({ op: CacheOp.Read, data: testData[0] })
	})

	it('Can overwrite address data', () => {
		const write = cache.step({
			op: CacheOp.Write,
			address: 0,
			data: testData[1],
		})

		expect(write).toEqual({ op: CacheOp.Write })

		const read = cache.step({
			op: CacheOp.Read,
			address: 0,
			widthBytes: testData[1].length,
		})

		expect(read).toEqual({ op: CacheOp.Read, data: testData[1] })
	})

	it('Can evict data', () => {
		const write = cache.step({
			op: CacheOp.Write,
			address: 4,
			data: testData[2],
		})

		expect(write).toEqual({ op: CacheOp.Write, evicted: { address: 0, data: testData[1] } })

		const failRead = cache.step({
			op: CacheOp.Read,
			address: 0,
			widthBytes: testData[1].length,
		})

		expect(failRead).toEqual({ op: CacheOp.Read })

		const read = cache.step({
			op: CacheOp.Read,
			address: 4,
			widthBytes: testData[1].length,
		})

		expect(read).toEqual({ op: CacheOp.Read, data: testData[2] })
	})
})
