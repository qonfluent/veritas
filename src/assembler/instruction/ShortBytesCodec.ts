import { BitstreamReader, BitstreamWriter, BufferedWritable } from '@astronautlabs/bitstream'
import assert from 'assert'
import { ShortInstruction } from '../../common/Assembly'
import { Codec } from '../../common/Codec'
import { ShortDecoderDesc, OperationDesc, RegisterFileDesc, ArgDesc, RegisterFileName } from '../../common/Processor'
import { clog2, rangeMap } from '../../common/Util'
import { createDecoderTree, DecoderQueueEntry, DecoderTree } from '../../processor/DecoderTree'
import { getMaxBodyBits } from '../../processor/ShortDecoder'

export type OpcodeEncoderData = {
	prefixBits: number
	prefix: number
	args: Record<string, ArgDesc>
	argBits: number
}

export class ShortInstructionBytesCodec implements Codec<ShortInstruction, Uint8Array> {
	private _trees: DecoderQueueEntry[][]
	private _headerBits: number
	private _shiftBits: number
	private _laneCountBits: number[]
	private _encoderData: OpcodeEncoderData[][][]
	private _shiftOffset: number

	public constructor(
		private readonly _desc: ShortDecoderDesc,
		private readonly _ops: OperationDesc[],
		private readonly _registerFiles: Record<RegisterFileName, RegisterFileDesc>,
	) {
		this._trees = this._desc.groups.map((lanes) => lanes.map((ops) => createDecoderTree(ops.map((op) => this._ops[op]), this._registerFiles)))
		this._shiftBits = clog2(Math.ceil(getMaxBodyBits({ groups: this._trees }) / 8))
		this._laneCountBits = this._desc.groups.map((lanes) => clog2(lanes.length))
		this._headerBits = this._shiftBits + this._laneCountBits.reduce((sum, bits) => sum + bits, 0)

		this._encoderData = this._desc.groups.map((lanes, groupIndex) => lanes.map((_, laneIndex) => {
			const entry = this._trees[groupIndex][laneIndex]
			const prefixes = this.getTreePrefixes(entry.tree)

			const result: OpcodeEncoderData[] = []
			prefixes.forEach((data, opcode) => {
				result[opcode] = data
			})

			return result
		}))

		const minBits = this._headerBits + this._trees.reduce((sum, lanes) => sum + lanes[0].bits, 0)
		this._shiftOffset = Math.ceil(minBits / 8)
	}

	private getTreePrefixes(tree: DecoderTree, prefix = 0, bits = 0): Map<number, OpcodeEncoderData> {
		if ('opcode' in tree) {
			return new Map([[tree.opcode, {
				prefixBits: bits,
				prefix,
				args: tree.args,
				argBits: Object.values(tree.args).reduce((sum, arg) => {
					if ('immediateBits' in arg) {
						return sum + arg.immediateBits
					} else if ('registerFile' in arg) {
						return sum + clog2(this._registerFiles[arg.registerFile].count)
					} else {
						return sum
					}
				}, 0),
			}]])
		}

		const zero = this.getTreePrefixes(tree.zero, prefix << 1, bits + 1)
		const one = this.getTreePrefixes(tree.one, (prefix << 1) | 1, bits + 1)

		const result = new Map([...zero.entries(), ...one.entries()])
		return result
	}

	public encodedBytes(instruction: ShortInstruction): number {
		const bits = this._headerBits + instruction.groups.reduce((sum, lanes, groupIndex) => {
			return sum + lanes.reduce((sum, _, laneIndex) => {
				return sum + this._trees[groupIndex][laneIndex].bits
			}, 0)
		}, 0)

		return Math.ceil(bits / 8)
	}

	public encode(instruction: ShortInstruction): Uint8Array {
		const buffer = new BufferedWritable()
		const writer = new BitstreamWriter(buffer)

		// Encode shift bytes
		if (instruction.shiftBytes === undefined) {
			instruction.shiftBytes = this.encodedBytes(instruction)
		}

		assert(instruction.shiftBytes >= this._shiftOffset, 'Shift bytes must be at least 1')
		assert(instruction.shiftBytes - this._shiftOffset <= Math.pow(2, this._shiftBits), `Shift bytes out of range (${instruction.shiftBytes} > ${Math.pow(2, this._shiftBits)})`)
		writer.write(this._shiftBits, instruction.shiftBytes - this._shiftOffset)

		// Encode lane counts
		instruction.groups.forEach((lanes, groupIndex) => {
			assert(lanes.length >= 1, 'No lanes in group')
			assert(lanes.length <= this._desc.groups[groupIndex].length, 'Too many lanes in group')

			writer.write(this._laneCountBits[groupIndex], lanes.length - 1)
		})

		// Encode lanes
		instruction.groups.forEach((lanes, groupIndex) => {
			lanes.forEach((lane, laneIndex) => {
				const beforeOffset = writer.offset

				// Encode opcode
				const encoderData = this._encoderData[groupIndex][laneIndex][lane.opcode]
				writer.write(encoderData.prefixBits, encoderData.prefix)

				// Encode padding
				const paddingBits = this._trees[groupIndex][laneIndex].bits - encoderData.prefixBits - encoderData.argBits
				writer.write(paddingBits, 0)

				// Encode args
				Object.entries(encoderData.args).forEach(([name, arg]) => {
					const value = lane.args[name]
					assert(value !== undefined, `Missing argument ${name}`)

					if ('immediateBits' in arg) {
						assert(value >= 0 && value < Math.pow(2, arg.immediateBits), `Argument ${name} out of range`)
						writer.write(arg.immediateBits, value)
					} else if ('registerFile' in arg) {
						const registerFile = this._registerFiles[arg.registerFile]
						assert(value >= 0 && value < registerFile.count, `Argument ${name} out of range`)
						writer.write(clog2(registerFile.count), value)
					}
				})

				assert(writer.offset - beforeOffset === this._trees[groupIndex][laneIndex].bits, 'Incorrect number of bits written')
			})
		})

		writer.end()
		assert(buffer.buffer.length === instruction.shiftBytes)
		return buffer.buffer
	}

	public decode(bytes: Uint8Array): ShortInstruction {
		const reader = new BitstreamReader()
		reader.addBuffer(bytes)

		// Decode shift bytes
		const shiftBytes = reader.readSync(this._shiftBits) + this._shiftOffset

		// Decode lane counts
		const laneCounts = this._laneCountBits.map((bits) => reader.readSync(bits) + 1)

		assert(reader.offset === this._headerBits, 'Incorrect number of bits read')

		// Decode lanes
		const groups = laneCounts.map((laneCount, groupIndex) => {
			return rangeMap(laneCount, (laneIndex) => {
				const beforeOffset = reader.offset
				
				// Decode opcode
				const entry = this._trees[groupIndex][laneIndex]

				let tree = entry.tree
				while (!('opcode' in tree)) {
					const bit = reader.readSync(1)
					tree = bit ? tree.one : tree.zero
				}

				// Decode padding
				const paddingBits = entry.bits - this._encoderData[groupIndex][laneIndex][tree.opcode].prefixBits - this._encoderData[groupIndex][laneIndex][tree.opcode].argBits
				assert(reader.readSync(paddingBits) === 0)

				// Decode args
				const args = Object.fromEntries(Object.entries(tree.args).flatMap(([name, arg]) => {
					if ('immediateBits' in arg) {
						const value = arg.immediateBits === 0 ? 0 : reader.readSync(arg.immediateBits)
						return [[name, value]]
					} else if ('registerFile' in arg) {
						const registerFile = this._registerFiles[arg.registerFile]
						const result = registerFile.count <= 1 ? 0 : reader.readSync(clog2(registerFile.count))
						assert(result >= 0 && result < registerFile.count)
						return [[name, result]]
					} else {
						return []
					}
				}))

				assert(reader.offset - beforeOffset === entry.bits, 'Incorrect number of bits read')

				return {
					opcode: tree.opcode,
					args,
				}
			})
		})
		
		return { shiftBytes, groups }
	}
}
