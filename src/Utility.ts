export function encodeBigInt(value: bigint, width: number): Uint8Array {
	const result: number[] = []

	while(value > 0) {
		result.push(Number(value & BigInt(0xFF)))
		value >>= BigInt(8)
	}

	while (result.length < Math.ceil(width / 8)) {
		result.push(0)
	}

	return new Uint8Array(result)
}

export function decodeBigInt(data: Uint8Array): bigint {
	let result = BigInt(0)

	for (let i = 0; i < data.length; i++) {
		result |= BigInt(data[i]) << BigInt(i * 8)
	}

	return result
}