import assert from "assert"

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

export class BitStream {
	private _value: bigint

	public constructor(
		value: Uint8Array = new Uint8Array(),
		private _length = value.length * 8,
	) {
		assert(_length >= 8 * value.length - 7 && _length >= 0, `Assigned length: ${_length}, calculated length: ${value.length}`)
		this._value = decodeBigInt(value)
	}

	public getBit(): boolean {
		assert(this._length >= 1)

		const result = (this._value & BigInt(1)) !== BigInt(0)
		this._value >>= BigInt(1)
		this._length--

		return result
	}

	public getNum(length: number): number {
		assert(length >= 0 && length < 32)
		assert(this._length >= length)
		const result = Number(this._value & BigInt(~(0xFFFFFFFF << length)))
		this._value >>= BigInt(length)
		this._length -= length
		return result
	}

	public appendBit(bit: boolean): void {
		this._value |= BigInt(bit ? 1 : 0) << BigInt(this._length)
		this._length++
	}

	public appendNum(value: number, length: number): void {
		this._value |= BigInt(value) << BigInt(this._length)
		this._length += length
	}

	public encode(): Uint8Array {
		return encodeBigInt(this._value, this._length)
	}
}
