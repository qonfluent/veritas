import { BufferedWritable, BitstreamWriter, BitstreamReader } from '@astronautlabs/bitstream'
import assert from 'assert'
import { Instruction } from '../../common/Assembly'
import { Codec } from '../../common/Codec'
import { ShortDecoderDesc, OperationDesc, RegisterFileName, RegisterFileDesc } from '../../common/Processor'
import { clog2, rangeMap } from '../../common/Util'
import { DecoderTree, createDecoderTree } from '../../processor/DecoderTree'

type OpcodeData = {
	value: number
	width: number
	args: [string, number][]
}

type IndexedOpcodeData = OpcodeData & { opcode: number }

export class ShortInstructionBytesCodec implements Codec<Instruction, Uint8Array> {
	private readonly _shiftBits: number
	private readonly _laneCountBits: number[]
	private readonly _headerBits: number
	private readonly _laneBits: number[][]
	private readonly _opcodes: OpcodeData[][][]

	private readonly _trees: DecoderTree[][]

	public constructor(
		private readonly _desc: ShortDecoderDesc,
		private readonly _ops: OperationDesc[],
		private readonly _registerFiles: Record<RegisterFileName, RegisterFileDesc>,
	) {
		this._laneCountBits = this._desc.groups.map((lanes) => Math.ceil(Math.log2(lanes.length)))

		const treeBase = this._desc.groups.map((lanes) => {
			return lanes.map((laneOps) => {
				const expandedLaneOps = laneOps.map((unitIndex) => {
					assert(unitIndex >= 0 && unitIndex < this._ops.length)
					return this._ops[unitIndex]
				})

				return createDecoderTree(expandedLaneOps, _registerFiles)
			})
		})

		this._trees = treeBase.map((lanes) => lanes.map((lane) => lane.tree))

		this._opcodes = this._trees.map((lanes) => {
			return lanes.map((tree) => {
				const data = this.getOpcodeData(tree)
				const result: OpcodeData[] = []
				data.forEach((op) => {
					assert(!(op.opcode in result))
					result[op.opcode] = op
				})

				return result
			})
		})

		this._laneBits = this._opcodes.map((lanes) => {
			return lanes.map((laneOps) => {
				return laneOps.reduce((max, op) => {
					return Math.max(max, op.width + op.args.reduce((sum, [_, bits]) => sum + bits, 0))
				}, 0)
			})
		})

		const maxBits = this._laneBits.reduce((sum, lanes) => {
			return sum + lanes.reduce((sum, bits) => sum + bits, 0)
		}, 0)

		this._shiftBits = clog2(Math.ceil(maxBits / 8))
		this._headerBits = this._shiftBits + this._laneCountBits.reduce((sum, bits) => sum + bits, 0)
	}

	public encodedBytes(instruction: Instruction): number {
		const bits = this._headerBits + instruction.groups.reduce((sum, lanes, groupIndex) => {
			return sum + lanes.reduce((sum, _, laneIndex) => {
				return sum + this._laneBits[groupIndex][laneIndex]
			}, 0)
		}, 0)

		return Math.ceil(bits / 8)
	}

	public encode(instruction: Instruction): Uint8Array {
		// Create output buffer
		const buffer = new BufferedWritable()
		const writer = new BitstreamWriter(buffer)

		// Encode shift bytes
		const shiftBytes = this.encodedBytes(instruction)
		writer.write(this._shiftBits, shiftBytes - 1)

		// Encode lane counts
		assert(instruction.groups.length === this._desc.groups.length, `Invalid group count: ${instruction.groups.length} (expected ${this._desc.groups.length})`)
		instruction.groups.forEach((lanes, groupIndex) => {
			assert(lanes.length >= 1 && lanes.length <= this._desc.groups[groupIndex].length, `Invalid lane count: ${lanes.length} (expected 1-${this._desc.groups[groupIndex].length})`)
			writer.write(this._laneCountBits[groupIndex], lanes.length - 1)
		})

		// Encode operations
		instruction.groups.forEach((lanes, groupIndex) => {
			lanes.forEach((laneOp, laneIndex) => {
				const startIndex = writer.offset
				// Encode opcode
				const { value, width, args } = this._opcodes[groupIndex][laneIndex][laneOp.opcode]
				writer.write(width, value)

				// Encode args
				args.forEach(([argName, argWidth]) => {
					const argValue = laneOp.args[argName]
					writer.write(argWidth, argValue)
				})

				// Encode padding
				const paddingBits = this._laneBits[groupIndex][laneIndex] - width - args.reduce((sum, [_, bits]) => sum + bits, 0)
				writer.write(paddingBits, 0)

				const writtenBits = writer.offset - startIndex
				assert(writtenBits === this._laneBits[groupIndex][laneIndex], `Invalid encoded instruction size: ${writtenBits} (expected ${this._laneBits[groupIndex][laneIndex]})`)
			})
		})

		// Return output buffer
		writer.end()
		assert(buffer.buffer.length === shiftBytes, `Invalid encoded instruction size: ${buffer.buffer.length} (expected ${shiftBytes})\n${this._shiftBits}\n${this._laneCountBits}\n${this._laneBits}\n${JSON.stringify(instruction)}\n${JSON.stringify(this._desc)}\n${JSON.stringify(this._ops)}`)
		return buffer.buffer
	}

	public decode(data: Uint8Array): Instruction {
		const reader = new BitstreamReader()
		reader.addBuffer(data)

		// Decode shift bytes
		const shiftBytes = reader.readSync(this._shiftBits) + 1
		assert(shiftBytes > 0)

		// Decode lane counts
		const laneCounts = this._laneCountBits.map((bits) => reader.readSync(bits) + 1)

		// Decode operations
		const groups = laneCounts.map((laneCount, groupIndex) => {
			return rangeMap(laneCount, (laneIndex) => {
				assert(reader.isAvailable(this._laneBits[groupIndex][laneIndex]))

				const startIndex = reader.offset

				// Decode opcode
				let tree = this._trees[groupIndex][laneIndex]
				while (!('opcode' in tree)) {
					const bit = reader.readSync(1)
					tree = bit ? tree.one : tree.zero
				}

				const { opcode } = tree

				// Decode args
				const { args: argWidths, width: opcodeWidth } = this._opcodes[groupIndex][laneIndex][opcode]
				const argEntries = argWidths.map(([name, width]) => {
					return [name, reader.readSync(width)]
				})

				// Skip padding
				const paddingBits = this._laneBits[groupIndex][laneIndex] - opcodeWidth - argWidths.reduce((sum, [_, bits]) => sum + bits, 0)
				if (paddingBits > 0) {
					assert(reader.readSync(paddingBits) === 0)
				}
				assert(reader.offset - startIndex === this._laneBits[groupIndex][laneIndex], `Invalid decoded instruction size: ${reader.offset - startIndex} (expected ${this._laneBits[groupIndex][laneIndex]})`)
				
				// Pack results
				return {
					opcode,
					args: Object.fromEntries(argEntries)
				}
			})
		})

		return { groups, shiftBytes }
	}

	private getOpcodeData(tree: DecoderTree, value = 0, width = 0): IndexedOpcodeData[] {
		if ('opcode' in tree) {
			return [{
				opcode: tree.opcode,
				value,
				width,
				args: Object.entries(tree.args).flatMap(([name, desc]) => {
					if ('immediateBits' in desc) {
						return [[name, desc.immediateBits]]
					} else if ('registerFile' in desc) {
						return [[name, clog2(this._registerFiles[desc.registerFile].count)]]
					}

					return []
				})
			}]
		}

		return this.getOpcodeData(tree.zero, value << 1, width + 1).concat(this.getOpcodeData(tree.one, (value << 1) | 1, width + 1))
	}
}
