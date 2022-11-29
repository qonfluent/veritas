import assert from "assert"
import { BitStream } from "./BitStream"
import { DecoderDesc, Instruction } from "./Decoder"
import { OpcodeType } from "./Types"

export class Encoder {
	// Widths of the format blocks in bits
	private readonly _formatWidths: number[]

	// Count header bits
	private readonly _countBits: number[]

	// Total header bits
	private readonly _headerBits: number

	// Shift offset bytes
	private readonly _shiftOffset: number

	private readonly _encoderTables: Map<OpcodeType, [number, number]>[]

	public constructor(
		private readonly _desc: DecoderDesc,
	) {
		// Calculate format widths
		this._formatWidths = _desc.groups.map((group) => group.decoder.getMaxTotalWidth())

		// Calculate header bit count
		this._countBits = _desc.groups.map((group) => Math.ceil(Math.log2(group.lanes)))
		this._headerBits = _desc.shiftBits + this._countBits.reduce((accum, groupSize) => accum + groupSize, 0)
		
		// Calculate shift offset
		const minBodySize = this._formatWidths.reduce((accum, width) => accum + width)
		const totalBits = this._headerBits + minBodySize
		this._shiftOffset = Math.ceil(totalBits / 8)

		// Generate encoder tables
		this._encoderTables = this._desc.groups.map((group) => group.decoder.getEncoderTable())
	}

	public getInstructionBytes(ins: Instruction): number {
		const bodyBits = ins.groups.reduce((accum, format, i) => accum + format.ops.length * this._formatWidths[i], 0)
		const totalBits = this._headerBits + bodyBits
		return Math.ceil(totalBits / 8)
	}

	public encodeInstruction(ins: Instruction): BitStream {
		// Encode shift header
		const result = new BitStream()
		const insShift = this.getInstructionBytes(ins) - this._shiftOffset
		assert(insShift < Math.pow(2, this._desc.shiftBits))
		result.appendNum(insShift, this._desc.shiftBits)

		// Encode count headers
		assert(ins.groups.length === this._desc.groups.length)
		for (let i = 0; i < ins.groups.length; i++) {
			const format = ins.groups[i]
			assert(format.ops.length <= this._desc.groups[i].lanes, 'Too many operations in entry')
			const laneBits = Math.ceil(Math.log2(this._desc.groups[i].lanes))
			result.appendNum(format.ops.length - 1, laneBits)
		}

		// Encode the bodies
		for (let i = 0; i < ins.groups.length; i++) {
			for (let j = 0; j < ins.groups[i].ops.length; j++) {
				// Encode opcode
				const op = ins.groups[i].ops[j]
				const opcodeInfo = this._encoderTables[i].get(op.opcode)
				assert(opcodeInfo !== undefined)
				result.appendNum(opcodeInfo[0], opcodeInfo[1])

				// Encode args
				const expectedArgCount = this._desc.groups[i].ops[op.opcode].argTypes.length
				assert(op.args.length === expectedArgCount, `Expected ${expectedArgCount} arguments, got ${op.args.length}`)
				for (let k = 0; k < op.args.length; k++) {
					const arg = op.args[k]
					result.appendNum(arg.index, this._desc.modeSizes[arg.mode])
				}
			}
		}

		return result
	}
}
