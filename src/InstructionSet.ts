import assert from 'assert'

// An opcode is just an internal index, a number in this case
export type OpcodeType = number

// A decode tree maps out the bits of the prefix tree for an opcode
export type DecodeTree = {
	opcode: OpcodeType
} | {
	branches: DecodeTree[]
}

export enum ArgType {
	Reg,
}

export type ArgTypeSizeMap = { [K in ArgType]: number }

// Descrbies a single operation
export type OpcodeDesc = {
	argTypes: ArgType[]
}

// A format contains a group of related opcodes, grouped for compression and lane specializaiton
export type FormatDesc = {
	countBits: number
	decoder: DecodeTree
	ops: OpcodeDesc[]
}

// Describes an entire instruction set
export type InstructionSetDesc = {
	shiftBits: number
	argTypeSizes: ArgTypeSizeMap
	formats: FormatDesc[]
}

// Gets the max opcode bits from a decoder
export function getDecoderMaxHeaderWidth(decoder: DecodeTree): number {
	if ('opcode' in decoder) {
		return 0
	}

	// Recursive case, calculate max(branchBits)
	const branchBits = decoder.branches.map((branch) => getDecoderMaxHeaderWidth(branch))
	const maxBranchBits = branchBits.reduce((accum, branch) => accum > branch ? accum : branch)

	// Select bits = clog2(branchCount)
	const selectBits = Math.ceil(Math.log2(decoder.branches.length))

	// Total is select bits + max(branch bits)
	return selectBits + maxBranchBits
}

// Gets the max total bit width of a decoder
export function getDecoderMaxTotalWidth(decoder: DecodeTree, ops: OpcodeDesc[], argTypeSizes: ArgTypeSizeMap): number {
	if ('opcode' in decoder) {
		const argsLength = ops[decoder.opcode].argTypes.reduce((accum, argType) => accum + argTypeSizes[argType])
		return argsLength
	}

	// Recursive case, find the max of each branch's width
	const branchBits = decoder.branches.map((branch) => getDecoderMaxTotalWidth(branch, ops, argTypeSizes))
	const maxBranchBits = branchBits.reduce((accum, branch) => accum > branch ? accum : branch)

	// clog2(branches) bits used to select in decoder
	const selectBits = Math.ceil(Math.log2(decoder.branches.length))

	// Total is selectBits + max(branchBits)
	return selectBits + maxBranchBits
}

// Get the widths of each format, in bits
export function getFormatWidths(desc: InstructionSetDesc): number[] {
	return desc.formats.map((format) => getDecoderMaxTotalWidth(format.decoder, format.ops, desc.argTypeSizes))
}

export function getCountBits(desc: InstructionSetDesc): number {
	return desc.formats.reduce((accum, format) => accum + format.countBits, 0)
}

// Get the length of the smallest instruction in the instruction set, in bytes
export function getShiftOffsetBytes(desc: InstructionSetDesc): number {
	const formatWidths = getFormatWidths(desc)
	const minBodySize = desc.formats.reduce((accum, format) => accum + getDecoderMaxTotalWidth(format.decoder, format.ops, desc.argTypeSizes), 0)
	const totalBits = desc.shiftBits + getCountBits(desc) + minBodySize

	return Math.ceil(totalBits / 8)
}

export function getEncoderTable(decoder: DecodeTree): Map<OpcodeType, [bigint, number]> {
	if ('opcode' in decoder) {
		return new Map([[decoder.opcode, [BigInt(0), 0]]])
	}

	// Get branch tables
	const branchTables = decoder.branches.map((branch) => getEncoderTable(branch))

	// Merge tables
	const selectBits = Math.ceil(Math.log2(decoder.branches.length))
	const result: Map<OpcodeType, [bigint, number]> = new Map()
	branchTables.forEach((entry, i) => {
		entry.forEach(([bits, width], key) => {
			assert(!result.has(key))
			result.set(key, [(BigInt(i) << BigInt(width)) | bits, width + selectBits])
		})
	})

	return result
}
