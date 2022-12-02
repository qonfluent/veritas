import assert from "assert"
import { CacheUnit } from "../src/Cache"

const TEST_DATA_COUNT = 10

describe('Cache', () => {
	let cache: CacheUnit

	const testData = [...Array(TEST_DATA_COUNT)].map((_, i) => new Uint8Array([i, Math.floor(Math.random() * 256), 0, 0]))

	it('Can be created', () => {
		cache = new CacheUnit({
			widthBits: 32,
			rowCount: 4,
			ways: 1,
		})
	})

	it('Can be written to and read from', () => {
		const write = cache.step({
			write: true,
			address: 0,
			data: testData[0],
		})

		expect(write).toEqual({ write: true })

		const read = cache.step({
			write: false,
			address: 0,
		})

		expect(read).toEqual({ write: false, data: testData[0] })
	})

	it('Can overwrite address data', () => {
		const write = cache.step({
			write: true,
			address: 0,
			data: testData[1],
		})

		expect(write).toEqual({ write: true })

		const read = cache.step({
			write: false,
			address: 0,
		})

		expect(read).toEqual({ write: false, data: testData[1] })
	})

	it('Can evict data', () => {
		const write = cache.step({
			write: true,
			address: 4,
			data: testData[2],
		})

		expect(write).toEqual({ write: true, evicted: { address: 0, data: testData[1] } })

		const failRead = cache.step({
			write: false,
			address: 0,
		})

		expect(failRead).toEqual({ write: false })

		const read = cache.step({
			write: false,
			address: 4,
		})

		expect(read).toEqual({ write: false, data: testData[2] })
	})
})
