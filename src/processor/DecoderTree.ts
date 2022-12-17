import assert from 'assert'
import { GWModule, SignalT, Signal, Ternary, Constant, SignalLike } from 'gateware-ts'
import { OperationDesc, UnitIndex } from './Description'
import { ArgInfoMap } from './Types'

type DecoderTreeInner = {
	opcode: UnitIndex
} | {
	zero: DecoderTreeInner
	one: DecoderTreeInner
}

export class DecoderTreeModule extends GWModule {
	public decodeInput: SignalT = Signal()

	public opcode: SignalT = Signal()
	public args: SignalT = Signal()

	private readonly _inner: DecoderTreeInner
	private readonly _opcodeArgWidths: number[]

	public constructor(
		name: string,
		ops: OperationDesc[],
		private readonly _argInfo: ArgInfoMap,
		opcodeWidth = Math.ceil(Math.log2(ops.length)),
	) {
		assert(ops.length >= 1)
		assert(opcodeWidth >= Math.ceil(Math.log2(ops.length)))

		super(name)

		// Get opcode arg widths
		this._opcodeArgWidths = ops.map((op) => op.argTypes.reduce((accum, argType) => accum + this._argInfo[argType.tag].argBits, 0))

		// Handle one entry special case
		if (ops.length === 1) {
			this._inner = { opcode: 0 }
			return
		}
		
		// Map and sort ops
		const mappedEntries: { decoder: DecoderTreeInner, weight: number }[]
			= ops.map((_, opcode) => ({ decoder: { opcode }, weight: this._opcodeArgWidths[opcode] }))
		const sortedEntries = mappedEntries.sort(({ weight: lhs }, { weight: rhs }) => lhs === rhs ? 0 : lhs > rhs ? 1 : -1)

		while (sortedEntries.length > 2) {
			const [{ decoder: zero, weight: zeroWeight }, { decoder: one, weight: oneWeight }] = sortedEntries.splice(0, 2)
			const newNode = { decoder: { zero, one }, weight: 1 + Math.max(zeroWeight, oneWeight) }
			// TODO: Use a log search here instead of a linear search!
			const insertIndex = sortedEntries.findIndex(({ weight }) => weight > newNode.weight)
			if (insertIndex !== -1) {
				sortedEntries.splice(insertIndex, 0, newNode)
			} else {
				sortedEntries.push(newNode)
			}
		}

		this._inner = {
			zero: sortedEntries[0].decoder,
			one: sortedEntries[1].decoder,
		}
		
		// Set up signals
		this.decodeInput = this.input(Signal(this.getMaxTotalWidth()))
		this.opcode = this.output(Signal(opcodeWidth))
		this.args = this.output(Signal(this._opcodeArgWidths.reduce((max, val) => max > val ? max : val)))
	}

	public getMaxTotalWidth(inner?: DecoderTreeInner): number {
		inner = inner ?? this._inner

		if ('opcode' in inner) {
			// Base case. Add up arg widths for opcode
			const argsLength = (this._opcodeArgWidths[inner.opcode])
			return argsLength
		}
	
		// Recursive case. Find max of all branches total widths
		const zeroWidth = this.getMaxTotalWidth(inner.zero)
		const oneWidth = this.getMaxTotalWidth(inner.one)
	
		return 1 + (zeroWidth > oneWidth ? zeroWidth : oneWidth)
	}

	public describe(): void {
		this.combinationalLogic([
			this.opcode ['='] (this.getOpcode()),
			this.args ['='] (this.decodeInput ['>>'] (this.getOpcodeBits())),
		])
	}

	private getOpcode(inner?: DecoderTreeInner, index = 0): SignalLike {
		inner = inner ?? this._inner

		if ('opcode' in inner) {
			return Constant(this.opcode.width, inner.opcode)
		}

		return Ternary(this.decodeInput.bit(index), this.getOpcode(inner.one, index + 1), this.getOpcode(inner.zero, index + 1))
	}

	private getOpcodeBits(inner?: DecoderTreeInner, index = 0): SignalLike {
		inner = inner ?? this._inner

		const width = Math.ceil(Math.log2(this.decodeInput.width))
		if ('opcode' in inner) {
			return Constant(width, 0)
		}

		return Constant(width, 1) ['+'] (Ternary(this.decodeInput.bit(index), this.getOpcodeBits(inner.one, index + 1), this.getOpcodeBits(inner.zero, index + 1)))
	}
}
