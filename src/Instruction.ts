import assert = require("assert")
import { ArgType, getCountBits, getEncoderTable, getFormatWidths, getShiftOffsetBytes, InstructionSetDesc, OpcodeType } from "./InstructionSet"
import { decodeBigInt, encodeBigInt } from "./Utility"

export type RegisterIndex = number

export type ArgValue = {
	type: ArgType.Reg
	value: RegisterIndex
}

export type Operation = {
	opcode: OpcodeType
	args: ArgValue[]
}

export type FormatGroup = {
	ops: Operation[]
}

export type Instruction = {
	formats: FormatGroup[]
}

// Gets the length of an instruction in bytes
export function getInstructionBytes(ins: Instruction, desc: InstructionSetDesc): number {
	const formatWidths = getFormatWidths(desc)
	const bodyBits = ins.formats.reduce((accum, format, i) => accum + format.ops.length * formatWidths[i], 0)
	
	const totalBits = desc.shiftBits + getCountBits(desc) + bodyBits

	return Math.ceil(totalBits / 8)
}

export function encodeInstruction(ins: Instruction, desc: InstructionSetDesc): Uint8Array {
	// Encode shift header
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
		const encoderTable = getEncoderTable(desc.formats[i].decoder)
		for (let j = 0; j < ins.formats[i].ops.length; j++) {
			// Encode opcode
			const op = ins.formats[i].ops[j]
			const opcodeInfo = encoderTable.get(op.opcode)
			assert(opcodeInfo !== undefined)
			result |= BigInt(opcodeInfo[0]) << shift
			shift += BigInt(opcodeInfo[1])

			// Encode args
			for (let k = 0; k < op.args.length; k++) {
				const arg = op.args[k]
				result |= BigInt(arg.value) << shift
				shift += BigInt(desc.argTypeSizes[arg.type])
			}
		}
	}

	return encodeBigInt(result, Number(shift))
}

export function decodeInstruction(data: Uint8Array, desc: InstructionSetDesc): Instruction {
	let dataNum = decodeBigInt(data)

	// Read shift header
	const shift = Number(dataNum & ~BigInt(0xFFFFFFFF << desc.shiftBits))
	dataNum >>= BigInt(desc.shiftBits)

	// Read count headers
	const counts: number[] = []
	for (let i = 0; i < desc.formats.length; i++) {
		counts[i] = 1 + Number(dataNum & ~BigInt(0xFFFFFFFF << desc.formats[i].countBits))
		dataNum >>= BigInt(desc.formats[i].countBits)
	}

	// Read bodies
	const ops: Operation[][] = []
	for (let i = 0; i < desc.formats.length; i++) {
		ops[i] = []

		for (let j = 0; j < counts[i]; j++) {
			// Run decoder to get opcode
			const format = desc.formats[i]
			let { decoder } = format

			while(!('opcode' in decoder)) {
				const bit = (dataNum & BigInt(1)) !== BigInt(0)
				dataNum >>= BigInt(1)

				decoder = bit ? decoder.one : decoder.zero
			}

			const opcode = decoder.opcode

			// Get args
			const argTypes = format.ops[opcode].argTypes
			const args: ArgValue[] = []
			for (let k = 0; k < argTypes.length; k++) {
				const type = argTypes[i]
				const bitCount = desc.argTypeSizes[type]
				const value = Number(dataNum & ~BigInt(0xFFFFFFFF << bitCount))
				dataNum >>= BigInt(bitCount)
				args[k] = { type, value }
			}

			ops[i][j] = { opcode, args }
		}
	}

	return {
		formats: ops.map((ops) => ({ ops })),
	}
}
