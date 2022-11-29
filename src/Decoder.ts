import { BitStream } from "./BitStream"
import { DecoderTree } from "./DecoderTree"
import { ArgValue, ModeSizeMap, OperationDesc } from "./Operation"
import { OpcodeType } from "./Types"

export type InstructionGroupDesc = {
	lanes: number
	decoder: DecoderTree
	ops: OperationDesc[]
}

export type InstructionSetDesc = {
	shiftBits: number
	groups: InstructionGroupDesc[]
	modeSizes: ModeSizeMap
}

export type Operation = {
	opcode: OpcodeType
	args: ArgValue[]
}

export type InstructionGroup = {
	ops: Operation[]
}

export type Instruction = {
	groups: InstructionGroup[]
}

export type DecoderDesc = InstructionSetDesc

export type DecoderInput = {
	instruction: BitStream
}

export type DecoderOutput = {
	decoded: Instruction
	shift: number
}

export class DecoderUnit {
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

	public step(input: DecoderInput): DecoderOutput {
		// Load shift
		const shift = input.instruction.getNum(this._desc.shiftBits) + this._shiftOffset

		// Load count header bits
		const groupCount = this._desc.groups.length
		const counts: number[] = []
		for (let i = 0; i < groupCount; i++) {
			counts.push(1 + input.instruction.getNum(this._countBits[i]))
		}

		// Load bodies
		const ops: Operation[][] = []
		for (let i = 0; i < groupCount; i++) {
			// Get group description
			const group = this._desc.groups[i]

			// Add new group
			ops.push([])

			// Add group members up to count
			for (let j = 0; j < counts[i]; j++) {
				// Lookup opcode
				const opcode = group.decoder.lookup(input.instruction)

				// Lookup arg types and iterate
				const argTypes = group.ops[opcode].argTypes
				const args: ArgValue[] = []
				for (let k = 0; k < argTypes.length; k++) {
					// Get argument mode
					const mode = argTypes[k].mode

					// Get number of bits for mode
					const bitCount = this._desc.modeSizes[mode]

					// Add new argument
					args.push({ mode, index: input.instruction.getNum(bitCount) })
				}

				// Add new operation
				ops[i].push({ opcode, args })
			}
		}

		// TODO: Validate entire buffer was consumed

		return {
			shift,
			decoded: {
				groups: ops.map((group) => ({ ops: group }))
			},
		}
	}
}
