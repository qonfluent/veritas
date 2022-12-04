import assert from "assert"
import { DecoderDesc, Instruction } from "./Decoder"
import { OpcodeType } from "./Types"
import { BitstreamWriter } from '@astronautlabs/bitstream'
import StreamBuffers from 'stream-buffers'
import { DecoderTree } from "./DecoderTree"

export class Encoder {
	// Widths of the format blocks in bits
	private readonly _formatWidths: number[]

	// Count header bits
	private readonly _countBits: number[]

	// Total header bits
	private readonly _headerBits: number

	// Shift offset bytes
	private readonly _shiftOffset: number

	// TODO: Replace this type with [number, number][][]? Give it a typedef?
	private readonly _encoderTables: Map<OpcodeType, [number, number]>[]
	private readonly _paddingBits: number[][]

	private readonly _decoderTrees: DecoderTree[]

	public constructor(
		private readonly _desc: DecoderDesc,
	) {
		// Set up decoder trees
		this._decoderTrees = _desc.groups.map((desc) => new DecoderTree(desc.ops, _desc.modeSizes))

		// Calculate format widths
		this._formatWidths = this._decoderTrees.map((decoder) => decoder.getMaxTotalWidth())

		// Calculate header bit count
		this._countBits = _desc.groups.map((group) => Math.ceil(Math.log2(group.lanes)))
		this._headerBits = _desc.shiftBits + this._countBits.reduce((accum, groupSize) => accum + groupSize, 0)
		
		// Calculate shift offset
		const minBodySize = this._formatWidths.reduce((accum, width) => accum + width)
		const totalBits = this._headerBits + minBodySize
		this._shiftOffset = Math.ceil(totalBits / 8)

		// Generate encoder tables
		this._encoderTables = this._decoderTrees.map((decoder) => decoder.getEncoderTable())

		// Calculate padding bits
		this._paddingBits = _desc.groups.map((group, i) => {
			return group.ops.map((op, opcode) => {
				const argWidth = op.argTypes.reduce((accum, argType) => accum + _desc.modeSizes[argType.mode], 0)
				const opcodeWidth = this._encoderTables[i].get(opcode)
				assert(opcodeWidth !== undefined, 'Unknown opcode')

				return this._formatWidths[i] - opcodeWidth[1] - argWidth
			})
		})
	}

	public getInstructionBytes(ins: Instruction): number {
		const bodyBits = ins.groups.reduce((accum, format, i) => accum + format.ops.length * this._formatWidths[i], 0)
		const totalBits = this._headerBits + bodyBits
		return Math.ceil(totalBits / 8)
	}

	public encodeInstruction(ins: Instruction): Uint8Array {
		// Encode shift header
		const insLength = this.getInstructionBytes(ins)
		const buffer = new StreamBuffers.WritableStreamBuffer({ initialSize: insLength })
		const result = new BitstreamWriter(buffer)
		const insShift = insLength - this._shiftOffset
		assert(insShift < Math.pow(2, this._desc.shiftBits), 'Instruction too long')
		result.write(this._desc.shiftBits, insShift)

		// Encode count headers
		assert(ins.groups.length === this._desc.groups.length)
		for (let i = 0; i < ins.groups.length; i++) {
			const group = ins.groups[i]
			assert(group.ops.length >= 1, 'No operations in group')
			assert(group.ops.length <= this._desc.groups[i].lanes, 'Too many operations in entry')
			const laneBits = Math.ceil(Math.log2(this._desc.groups[i].lanes))
			result.write(laneBits, group.ops.length - 1)
		}

		// Encode the bodies
		for (let i = 0; i < ins.groups.length; i++) {
			for (let j = 0; j < ins.groups[i].ops.length; j++) {
				// Encode opcode
				const startBit = result.offset
				const op = ins.groups[i].ops[j]
				const opcodeInfo = this._encoderTables[i].get(op.opcode)
				assert(opcodeInfo !== undefined, 'Unknown opcode')
				result.write(opcodeInfo[1], opcodeInfo[0])

				// Encode padding bits
				result.write(this._paddingBits[i][op.opcode], 0)

				// Encode args
				const expectedArgCount = this._desc.groups[i].ops[op.opcode].argTypes.length
				assert(op.args.length === expectedArgCount, `Expected ${expectedArgCount} arguments, got ${op.args.length}`)
				for (let k = 0; k < op.args.length; k++) {
					const arg = op.args[k]
					result.write(this._desc.modeSizes[arg.mode], arg.index)
				}
			}
		}

		// Add final padding
		const padBits = 8 - (result.offset % 8)
		if (padBits !== 8) {
			result.write(padBits, 0)
		}

		// Validate length
		assert(result.offset === insLength * 8)

		buffer.end()
		return buffer.getContents()
	}
}
