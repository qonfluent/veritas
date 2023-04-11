export function concat(...data: Uint8Array[]): Uint8Array {
	const length = data.reduce((acc, d) => acc + d.length, 0)
	const result = new Uint8Array(length)
	let offset = 0
	for (const d of data) {
		result.set(d, offset)
		offset += d.length
	}
	return result
}

export function encodeVarnat(n: number): Uint8Array {
	const result: number[] = []
	while (n > 0) {
		result.push((n & 0x7f) | 0x80)
		n >>= 7
	}
	return new Uint8Array(result.reverse())
}

export function decodeVarnat(data: Uint8Array): [number, number] {
	let n = 0
	let i = 0
	while (i < data.length) {
		const b = data[i++]
		n = (n << 7) | (b & 0x7f)
		if ((b & 0x80) === 0) break
	}

	return [n, i]
}
