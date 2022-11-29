import assert from "assert"
import { BitStream } from "./BitStream"
import { ModeSizeMap, OperationDesc } from "./Operation"
import { OpcodeType } from "./Types"

type DecoderTreeInner = {
	opcode: OpcodeType
} | {
	zero: DecoderTreeInner
	one: DecoderTreeInner
}

export class DecoderTree {
	private readonly _inner: DecoderTreeInner
	private readonly _opcodeWidths: number[]

	public constructor(
		private readonly _entries: OperationDesc[],
		private readonly _modeSizes: ModeSizeMap,
	) {
		assert(_entries.length >= 1)

		this._opcodeWidths = _entries.map((op) => op.argTypes.reduce((accum, argType) => accum + this._modeSizes[argType.mode], 0))

		// Handle one entry special case
		if (_entries.length === 1) {
			this._inner = { opcode: 0 }
			return
		}
		
		// Map and sort entries
		const mappedEntries: { decoder: DecoderTreeInner, weight: number }[]
			= _entries.map((_, opcode) => ({ decoder: { opcode }, weight: this._opcodeWidths[opcode] }))
		const sortedEntries = mappedEntries.sort(({ weight: lhs }, { weight: rhs }) => lhs === rhs ? 0 : lhs > rhs ? 1 : -1)

		while (sortedEntries.length > 2) {
			const [{ decoder: zero, weight: zeroWeight }, { decoder: one, weight: oneWeight }] = sortedEntries.splice(0, 2)
			const newNode = { decoder: { zero, one }, weight: zeroWeight + oneWeight }
			// TODO: Use a log search here instead of a linear search!
			const insertIndex = sortedEntries.findIndex(({ weight }) => weight > newNode.weight)
			sortedEntries.splice(insertIndex, 0, newNode)
		}

		this._inner = {
			zero: sortedEntries[0].decoder,
			one: sortedEntries[1].decoder,
		}
	}

	public getMaxTotalWidth(inner?: DecoderTreeInner): number {
		inner = inner ?? this._inner

		if ('opcode' in inner) {
			// Base case. Add up arg widths for opcode
			const argsLength = (this._opcodeWidths[inner.opcode])
			return argsLength
		}
	
		// Recursive case. Find max of all branches total widths
		const zeroWidth = this.getMaxTotalWidth(inner.zero)
		const oneWidth = this.getMaxTotalWidth(inner.one)
	
		return 1 + (zeroWidth > oneWidth ? zeroWidth : oneWidth)
	}

	public lookup(bits: BitStream): OpcodeType {
		let decoder = this._inner

		while(!('opcode' in decoder)) {
			const bit = bits.getBit()
			decoder = bit ? decoder.one : decoder.zero
		}

		return decoder.opcode
	}

	public getEncoderTable(inner?: DecoderTreeInner): Map<OpcodeType, BitStream> {
		inner = inner ?? this._inner

		if ('opcode' in inner) {
			return new Map([[inner.opcode, new BitStream()]])
		}
	
		// Get branch tables
		const zeroTable = this.getEncoderTable(inner.zero)
		const oneTable = this.getEncoderTable(inner.one)
	
		// Merge tables
		const result: Map<OpcodeType, BitStream> = new Map()
		zeroTable.forEach((bits, opcode) => {
			bits.appendBit(false)
			result.set(opcode, bits)
		})
		oneTable.forEach((bits, opcode) => {
			bits.appendBit(true)
			result.set(opcode, bits)
		})
	
		return result
	}
}
