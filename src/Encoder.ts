import { DecoderDesc, Instruction } from "./Decoder"

export class Encoder {
	// Widths of the format blocks in bits
	private readonly _formatWidths: number[]

	// Count header bits
	private readonly _countBits: number[]

	// Total header bits
	private readonly _headerBits: number

	// Shift offset bytes
	private readonly _shiftOffset: number


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
	}

	public getInstructionBytes(ins: Instruction): number {
		const bodyBits = ins.groups.reduce((accum, format, i) => accum + format.ops.length * this._formatWidths[i], 0)
		const totalBits = this._headerBits + bodyBits
		return Math.ceil(totalBits / 8)
	}

	public encodeInstruction(ins: Instruction): Uint8Array {
		// Encode shift header
		// TODO: Pass in shift offset so it can be cached
		/*
		const insShift = getInstructionBytes(ins, desc) - getShiftOffsetBytes(desc)
		assert(insShift < Math.pow(2, desc.shiftBits))

		let result = BigInt(insShift)
		let shift = BigInt(desc.shiftBits)

		// Encode count header
		for (let i = 0; i < ins.formats.length; i++) {
			const format = ins.formats[i]
			assert(format.ops.length <= Math.pow(2, desc.formats[i].countBits), 'Too many operations in entry')
			result |= BigInt(format.ops.length - 1) << shift
			shift += BigInt(desc.formats[i].countBits)
		}

		// Encode the bodies
		for (let i = 0; i < ins.formats.length; i++) {
			// TODO: Cache this
			for (let j = 0; j < ins.formats[i].ops.length; j++) {
				// Encode opcode
				const op = ins.formats[i].ops[j]
				const opcodeInfo = encoderTables[i].get(op.opcode)
				assert(opcodeInfo !== undefined)
				result |= BigInt(opcodeInfo[0]) << shift
				shift += BigInt(opcodeInfo[1])

				// Encode args
				for (let k = 0; k < op.args.length; k++) {
					const arg = op.args[k]
					result |= BigInt(arg.value) << shift
					shift += BigInt(desc.modeSizes[arg.mode])
				}
			}
		}

		return encodeBigInt(result, Number(shift))
		*/

		return new Uint8Array()
	}
}
