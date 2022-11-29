import assert from 'assert'

// An opcode is just an internal index, a number in this case
export type OpcodeType = number

// A decode tree maps out the bits of the prefix tree for an opcode
export type DecodeTree = {
	opcode: OpcodeType
} | {
	zero: DecodeTree
	one: DecodeTree
}

export type EncoderTable = Map<OpcodeType, [bigint, number]>

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

export function getOpArgsWidth(op: OpcodeDesc, argTypeSizes: ArgTypeSizeMap): number {
	return op.argTypes.reduce((accum, argType) => accum + argTypeSizes[argType])
}

export function createDecoder(entries: OpcodeDesc[], argSizes: ArgTypeSizeMap): DecodeTree {
	assert(entries.length >= 1)

	// Handle one entry special case
	if (entries.length === 1) {
		return { opcode: 0 }
	}
	
	// Map and sort entries
	const mappedEntries: { decoder: DecodeTree, weight: number }[] = entries.map((op, opcode) => ({ decoder: { opcode }, weight: getOpArgsWidth(op, argSizes) }))
	const sortedEntries = mappedEntries.sort(({ weight: lhs }, { weight: rhs }) => lhs === rhs ? 0 : lhs > rhs ? 1 : -1)

	while (sortedEntries.length > 2) {
		const [{ decoder: zero, weight: zeroWeight }, { decoder: one, weight: oneWeight }] = sortedEntries.splice(0, 2)
		const newNode = { decoder: { zero, one }, weight: zeroWeight + oneWeight }
		// TODO: Use a log search here instead of a linear search!
		const insertIndex = sortedEntries.findIndex(({ weight }) => weight > newNode.weight)
		sortedEntries.splice(insertIndex, 0, newNode)
	}

	return {
		zero: sortedEntries[0].decoder,
		one: sortedEntries[1].decoder,
	}
}

// Gets the max total bit width of a decoder
export function getDecoderMaxTotalWidth(decoder: DecodeTree, ops: OpcodeDesc[], argTypeSizes: ArgTypeSizeMap): number {
	if ('opcode' in decoder) {
		// Base case. Add up arg widths for opcode
		const argsLength = getOpArgsWidth(ops[decoder.opcode], argTypeSizes)
		return argsLength
	}

	// Recursive case. Find max of all branches total widths
	const zeroWidth = getDecoderMaxTotalWidth(decoder.zero, ops, argTypeSizes)
	const oneWidth = getDecoderMaxTotalWidth(decoder.one, ops, argTypeSizes)

	return 1 + (zeroWidth > oneWidth ? zeroWidth : oneWidth)
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

// Get the encoder table from a decoder tree
export function getEncoderTable(decoder: DecodeTree): EncoderTable {
	if ('opcode' in decoder) {
		return new Map([[decoder.opcode, [BigInt(0), 0]]])
	}

	// Get branch tables
	const zeroTable = getEncoderTable(decoder.zero)
	const oneTable = getEncoderTable(decoder.one)

	// Merge tables
	const result: Map<OpcodeType, [bigint, number]> = new Map()
	zeroTable.forEach(([bits, width], opcode) => {
		result.set(opcode, [bits, 1 + width])
	})
	oneTable.forEach(([bits, width], opcode) => {
		result.set(opcode, [(BigInt(1) << BigInt(width)) | bits, 1 + width])
	})

	return result
}
