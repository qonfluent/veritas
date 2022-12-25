import { BitstreamReader, BitstreamWriter, BufferedWritable } from '@astronautlabs/bitstream'
import assert from 'assert'
import { createDecoderTreeDescriptions, DecoderDesc, OperationArgs } from '../processor/Decoder'
import { DecoderTreeDescFull, getInstructionBits } from '../processor/DecoderTree'
import { clog2 } from '../Util'

export type Operation = {
	opcode: number
	args: Record<string, number>
}

export type Instruction = {
	groups: Operation[][]
}

type OpcodeInfo = {
	header: number
	headerBits: number
}

type ArgsInfo = {
	args: Record<string, number>
	argBits: number
}

type EncoderOperationInfo = OpcodeInfo & ArgsInfo

export class Encoder {
	private _trees: DecoderTreeDescFull[][]
	private _operationInfo: EncoderOperationInfo[][][]
	private _laneCountBits: number[]
	private _shiftBits: number
	private _shiftOffset: number
	private _headerBits: number

	public constructor(
		decoder: DecoderDesc,
		operations: OperationArgs[],
	) {
		// Create the decoder trees for each lane
		this._trees = createDecoderTreeDescriptions(decoder, operations)
		console.log(JSON.stringify(this._trees))

		// Get lengths of each lane/group/total
		const laneLengths = this._trees.map((lanes) => lanes.map((tree) => getInstructionBits(tree)))
		const groupLengths = laneLengths.map((lanes) => lanes.reduce((sum, val) => sum + val, 0))
		const maxBytes = Math.ceil(groupLengths.reduce((sum, val) => sum + val, 0) / 8)

		// Generate header/arg info
		this._operationInfo = decoder.groups.map((lanes, i) => lanes.map((ops, j) => ops.map((op) => {
			const operation = operations[op]
			assert(operation !== undefined, `Operation ${op} does not exist in operations. Max allowed: ${operations.length - 1}`)

			const opcode = this.getOpcodeInfo(op, this._trees[i][j])
			assert(opcode !== undefined, `Operation ${op} does not exist in trees`)

			return { ...opcode, args: operation.args, argBits: Object.values(operation.args).reduce((sum, val) => sum + val, 0) }
		})))

		this._laneCountBits = decoder.groups.map((lanes) => clog2(lanes.length))

		this._shiftOffset = Math.ceil(laneLengths.reduce((sum, lanes) => sum + lanes[0], 0) / 8)
		this._shiftBits = clog2(maxBytes - this._shiftOffset)
		this._headerBits = this._shiftBits + this._laneCountBits.reduce((sum, val) => sum + val, 0)
	}

	public get groupCount(): number {
		return this._trees.length
	}

	public get shiftBits(): number {
		return this._shiftBits
	}

	public get operationArgs(): OperationArgs[][][] {
		return this._operationInfo
	}

	public getLaneCount(groupIndex: number): number {
		return this._trees[groupIndex].length
	}

	public instructionBytes(instruction: Instruction): number {
		// Add up total bits = header + groups
		const bits = this._headerBits + instruction.groups.reduce((sum, lanes, groupIndex) => {
			// Add up groups
			return sum + lanes.reduce((sum, operation, laneIndex) => {
				// Add up lanes
				const info = this._operationInfo[groupIndex][laneIndex][operation.opcode]
				return sum + info.headerBits + info.argBits
			}, 0)
		}, 0)

		return Math.floor(bits / 8)
	}

	public encodeInstruction(instruction: Instruction): Uint8Array {
		// Validate instruction
		assert(instruction.groups.length === this.groupCount, `Too few groups in instruction`)

		instruction.groups.forEach((lanes, groupIndex) => {
			assert(lanes.length >= 1, `Too few lanes in group ${groupIndex}`)
			assert(lanes.length <= this.getLaneCount(groupIndex), `Too many lanes in group ${groupIndex}`)

			lanes.forEach((operation, laneIndex) => {
				assert(operation.opcode >= 0, `Invalid opcode in group ${groupIndex} lane ${laneIndex}`)
				assert(operation.opcode < this._operationInfo[groupIndex][laneIndex].length, `Invalid opcode ${operation.opcode} in group ${groupIndex} lane ${laneIndex}`)
			})
		})

		// Create a bitstream writer
		const buffer = new BufferedWritable()
		const writer = new BitstreamWriter(buffer)

		// Encode shift width
		const shiftBytes = this.instructionBytes(instruction)
		writer.write(this._shiftBits, shiftBytes - this._shiftOffset)
		
		// Encode lane counts
		instruction.groups.forEach((lanes, groupIndex) => {
			writer.write(this._laneCountBits[groupIndex], lanes.length - 1)
		})

		// Encode body
		instruction.groups.forEach((lanes, groupIndex) => {
			lanes.forEach((operation, laneIndex) => {
				this.encodeOperation(writer, operation, this._operationInfo[groupIndex][laneIndex])
			})
		})

		// Flush the writer and return the buffer
		writer.end()
		return buffer.buffer
	}

	public decodeInstruction(buffer: Uint8Array): Instruction {
		// Create a bitstream reader
		const reader = new BitstreamReader()
		reader.addBuffer(buffer)

		// Decode shift width
		const shiftBytes = reader.readSync(this._shiftBits) + this._shiftOffset

		// Decode lane counts
		const laneCounts = this._laneCountBits.map((bits) => reader.readSync(bits))

		// Decode body
		const groups = this._operationInfo.map((lanes, groupIndex) => {
			const count = laneCounts[groupIndex]
			const group: Operation[] = []

			for (let laneIndex = 0; laneIndex <= count; laneIndex++) {
				group.push(this.decodeOperation(reader, this._trees[groupIndex][laneIndex], lanes[laneIndex]))
			}

			return group
		})

		// Validate instruction
		assert(groups.length === this.groupCount, `Too few groups in instruction. Expected ${this.groupCount}, got ${groups.length}`)

		// Return the instruction
		return { groups }
	}

	private encodeOperation(writer: BitstreamWriter, operation: Operation, opsInfo: EncoderOperationInfo[]): void {
		// Load operation info
		const info = opsInfo[operation.opcode]
		assert(info !== undefined, `Operation ${operation.opcode} does not exist in operations`)

		// Wirte header
		writer.write(info.headerBits, info.header)

		// Write arguments
		Object.entries(operation.args).forEach(([name, value]) => {
			const bits = info.args[name]
			assert(bits !== undefined, `Operation ${operation.opcode} does not have argument ${name}`)

			writer.write(bits, value)
		})
	}

	private decodeOperation(reader: BitstreamReader, tree: DecoderTreeDescFull, opsInfo: EncoderOperationInfo[]): Operation {
		if ('opcode' in tree) {
			const entries = Object.entries(opsInfo[tree.opcode].args).map(([name, length]) => [name, reader.readSync(length)])
			return { opcode: tree.opcode, args: Object.fromEntries(entries) }
		}

		const bit = reader.readSync(1)
		return this.decodeOperation(reader, bit === 0 ? tree.zero : tree.one, opsInfo)
	}

	private getOpcodeInfo(opcode: number, tree: DecoderTreeDescFull, header = 0, headerBits = 0): OpcodeInfo | undefined {
		if ('opcode' in tree) {
			return tree.opcode === opcode ? { header, headerBits } : undefined
		}

		return this.getOpcodeInfo(opcode, tree.zero, header << 1, headerBits + 1) ?? this.getOpcodeInfo(opcode, tree.one, (header << 1) | 1, headerBits + 1)
	}
}
