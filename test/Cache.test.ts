import { CacheUnit } from "../src/Cache"

describe('Cache', () => {
	it('Can be read/write', () => {
		const cache = new CacheUnit({
			widthBits: 32,
			rowCount: 4,
			ways: 1,
		})

		const data = new Uint8Array([1, 2, 3, 4])
		const write = cache.step({
			write: true,
			address: 0,
			data,
		})

		expect(write).toEqual({ write: true })

		const read = cache.step({
			write: false,
			address: 0,
		})

		expect(read).toEqual({ write: false, data })
	})
})
