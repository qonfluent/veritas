import { BitstreamReader, BitstreamWriter, BufferedWritable } from '@astronautlabs/bitstream'
import assert from 'assert'
import { Instruction, Operation } from '../common/Assembly'
import { Codec } from '../common/Codec'
import { ArgDesc, DecoderDesc, OperationDesc, RegisterFileDesc, RegisterFileName } from '../common/Processor'
import { clog2, rangeMap } from '../common/Util'
import { createDecoderTree, DecoderQueueEntry, DecoderTree } from '../processor/DecoderTree'

export class InstructionBytesCodec implements Codec<Instruction, Uint8Array> {
	private readonly _trees: DecoderQueueEntry[][]
	private readonly _shiftBits: number
	private readonly _shiftOffset: number
	private readonly _laneCountBits: number[]
	private readonly _headerBits: number
	
	public constructor(
		private readonly _desc: DecoderDesc,
		private readonly _ops: OperationDesc[],
		private readonly _registerFiles: Record<RegisterFileName, RegisterFileDesc>,
	) {
		this._trees = this._desc.groups.map((lanes) => lanes.map((ops) => {
			const routedOps = ops.map((op) => {
				if (!(op in _ops)) {
					throw new Error(`Operation ${op} not found`)
				}

				return _ops[op]
			})

			return createDecoderTree(routedOps, this._registerFiles)
		}))
		
		const minSizeBytes = Math.ceil(this._trees.reduce((sum, lanes) => sum + lanes[0].bits, 0) / 8)
		const maxSizeBytes = Math.ceil(this._trees.reduce((sum, lanes) => sum + lanes.reduce((sum, entry) => sum + entry.bits, 0), 0) / 8)
		const sizeDiff = maxSizeBytes - minSizeBytes

		this._shiftOffset = minSizeBytes
		this._shiftBits = clog2(sizeDiff)

		this._laneCountBits = this._desc.groups.map((lanes) => clog2(lanes.length))
		this._headerBits = this._shiftBits + this._laneCountBits.reduce((sum, bits) => sum + bits, 0)
	}

	public encodedBytes(instruction: Instruction): number {
		const totalBits = this._headerBits + instruction.groups.reduce((sum, lanes, groupIndex) => {
			return sum + lanes.reduce((sum, _, laneIndex) => {
				return sum + this._trees[groupIndex][laneIndex].bits
			}, 0)
		}, 0)

		return Math.ceil(totalBits / 8)
	}

	public encode(instruction: Instruction): Uint8Array {
		// Validate instruction
		assert(instruction.groups.length === this._desc.groups.length, `Expected ${this._desc.groups.length} groups, got ${instruction.groups.length}`)
		instruction.groups.forEach((lanes, groupIndex) => {
			assert(lanes.length >= 1, `Expected at least 1 lane, got ${lanes.length}`)
			assert(lanes.length <= this._desc.groups[groupIndex].length, `Expected at most ${this._desc.groups[groupIndex].length} lanes, got ${lanes.length}`)

			lanes.forEach((laneOp, laneIndex) => {
				assert(laneOp.opcode >= 0 && laneOp.opcode < this._desc.groups[groupIndex][laneIndex].length, `Invalid opcode ${laneOp.opcode} for lane ${laneIndex} in group ${groupIndex}`)

				const opIndex = this._desc.groups[groupIndex][laneIndex][laneOp.opcode]
				const opDesc = this._ops[opIndex]

				Object.entries(laneOp.args).forEach(([argName, argValue]) => {
					const argDesc = opDesc.args[argName]

					if ('immediateBits' in argDesc) {
						assert(argValue >= 0 && argValue < (1 << argDesc.immediateBits), `Invalid immediate value ${argValue} for argument ${argName} in opcode ${opDesc.opcode}`)
					} else if ('registerFile' in argDesc) {
						assert(argValue >= 0 && argValue < this._registerFiles[argDesc.registerFile].count, `Invalid register value ${argValue} for argument ${argName} in opcode ${opDesc.opcode}`)
					} else if ('cache' in argDesc) {
						// Nothing to do here
					} else {
						throw new Error(`Unknown arg type: ${JSON.stringify(argDesc)}`)
					}
				})
			})
		})

		// Create writer
		const buffer = new BufferedWritable()
		const writer = new BitstreamWriter(buffer)

		// Write header
		writer.write(this._shiftBits, this.encodedBytes(instruction) - this._shiftOffset)
		instruction.groups.forEach((lanes, groupIndex) => {
			writer.write(this._laneCountBits[groupIndex], lanes.length - 1)
		})

		// Write operations
		instruction.groups.forEach((lanes, groupIndex) => {
			lanes.forEach((laneOp, laneIndex) => {
				const tree = this._trees[groupIndex][laneIndex].tree
				const opcodeData = this.encodeOpcode(tree, laneOp.opcode)

				if (opcodeData === undefined) {
					throw new Error(`Opcode ${laneOp.opcode} not found in tree`)
				}

				const [opcodeWidth, opcodeValue] = opcodeData
				writer.write(opcodeWidth, opcodeValue)

				const opIndex = this._desc.groups[groupIndex][laneIndex][laneOp.opcode]
				const opDesc = this._ops[opIndex]

				Object.entries(laneOp.args).forEach(([argName, argValue]) => {
					const argDesc = opDesc.args[argName]

					if ('immediateBits' in argDesc) {
						writer.write(argDesc.immediateBits, argValue)
					} else if ('registerFile' in argDesc) {
						writer.write(clog2(this._registerFiles[argDesc.registerFile].count), argValue)
					} else if ('cache' in argDesc) {
						throw new Error(`Cache arguments should not be encoded: ${JSON.stringify(argDesc)}`)
					} else {
						throw new Error(`Unknown arg type: ${JSON.stringify(argDesc)}`)
					}
				})
			})
		})

		// Return buffer
		writer.end()
		return buffer.buffer
	}

	public decode(data: Uint8Array): Instruction {
		const reader = new BitstreamReader()
		reader.addBuffer(data)

		// Read header
		const shiftBytes = reader.readSync(this._shiftBits) + this._shiftOffset
		const laneCounts = this._laneCountBits.map((bits) => reader.readSync(bits) + 1)

		// Read operations
		const groups = laneCounts.map((laneCount, groupIndex) => {
			return rangeMap(laneCount, (laneIndex) => {
				const tree = this._trees[groupIndex][laneIndex].tree
				const [opcode, args] = this.decodeOpcode(tree, reader)

				const resultArgs = Object.entries(args).flatMap(([argName, argDesc]) => {
					if ('immediateBits' in argDesc) {
						return [[argName, reader.readSync(argDesc.immediateBits)]]
					} else if ('registerFile' in argDesc) {
						return [[argName, reader.readSync(clog2(this._registerFiles[argDesc.registerFile].count))]]
					} else if ('cache' in argDesc) {
						return []
					} else {
						throw new Error(`Unknown arg type: ${JSON.stringify(argDesc)}`)
					}
				})

				return { opcode, args: Object.fromEntries(resultArgs) }
			})
		})

		return { groups, shiftBytes }
	}

	private encodeOpcode(tree: DecoderTree, opcode: number, width = 0, value = 0): [width: number, value: number] | undefined {
		if ('opcode' in tree) {
			return opcode === tree.opcode ? [width, value] : undefined
		}

		return this.encodeOpcode(tree.zero, opcode, width + 1, value << 1) ?? this.encodeOpcode(tree.one, opcode, width + 1, (value << 1) | 1)
	}

	private decodeOpcode(tree: DecoderTree, reader: BitstreamReader): [number, Record<string, ArgDesc>] {
		if ('opcode' in tree) {
			return [tree.opcode, tree.args]
		}

		return reader.readSync(1) === 0 ? this.decodeOpcode(tree.zero, reader) : this.decodeOpcode(tree.one, reader)
	}
}

export class InstructionTextCodec implements Codec<Instruction, string> {
	public constructor(
		private readonly _desc: DecoderDesc,
		private readonly _ops: OperationDesc[],
		private readonly _registerFiles: Record<RegisterFileName, RegisterFileDesc>,
	) {}

	public encode(instruction: Instruction): string {
		const encodedOps = instruction.groups.map((lanes, groupIndex) => {
			return lanes.map((laneOp, laneIndex) => {
				const opcode = this._desc.groups[groupIndex][laneIndex][laneOp.opcode]
				const op = this._ops[opcode]

				const args = Object.entries(laneOp.args).flatMap(([argName, argValue]) => {
					const arg = op.args[argName]

					if ('immediateBits' in arg) {
						return [argValue.toString()]
					} else if ('registerFile' in arg) {
						return [`r${argValue}`]
					} else if ('cache' in arg) {
						return []
					} else {
						throw new Error(`Unknown arg type: ${JSON.stringify(arg)}`)
					}
				})

				return `${op.opcode} ${args.join(' ')}`
			})
		})

		return `[${encodedOps.map((lanes) => lanes.join(' | ')).join('] [')}]`
	}

	public decode(text: string): Instruction {
		// Validate outermost brackets
		if (!(text[0] === '[' && text[text.length - 1] === ']')) {
			throw new Error(`Invalid instruction, missing outer brackets: ${text}`)
		}

		// Split into groups
		const baseGroups = text.slice(1, -1).split('] [')
		if (baseGroups.length !== this._desc.groups.length) {
			throw new Error(`Invalid number of groups, expected ${this._desc.groups.length}, got ${baseGroups.length} in:\n${text}`)
		}

		// Split into lanes
		const groups = baseGroups.map((lanes, groupIndex) => {
			const baseLanes = lanes.split(' | ')
			if (!(baseLanes.length >= 1 && baseLanes.length <= this._desc.groups[groupIndex].length)) {
				throw new Error(`Invalid number of lanes, expected 1-${this._desc.groups[groupIndex].length}, got ${baseLanes.length} in:\n${text}`)
			}

			return baseLanes.map((op, laneIndex) => {
				// Extract opcode and args
				const parts = op.split(' ')
				const opcode = parts[0]
				const args = parts.slice(1)

				// Find opcode in op list
				const opIndex = this._ops.findIndex((op) => op.opcode === opcode)
				if (opIndex === -1) {
					throw new Error(`Unknown opcode: ${opcode}`)
				}
				
				// Get op description
				const opDesc = this._ops[opIndex]

				// Validate args
				const argValues = Object.entries(opDesc.args).flatMap(([argName, argDesc], argIndex) => {
					const arg = args[argIndex]

					if (arg === undefined) {
						throw new Error(`Missing arg: ${argName}`)
					}

					if ('immediateBits' in argDesc) {
						// Validate value
						const value = Number(arg)
						if (value >= 0 && value < (1 << argDesc.immediateBits)) {
							throw new Error(`Invalid immediate arg: ${arg}`)
						}

						return [[argName, value]]
					} else if ('registerFile' in argDesc) {
						// Validate register file exists
						const regFile = this._registerFiles[argDesc.registerFile]
						if (regFile === undefined) {
							throw new Error(`Unknown register file: ${argDesc.registerFile}`)
						}

						// Get prefix from register file
						const expectedPrefix = regFile.prefix

						// Validate prefix
						if (!arg.startsWith(expectedPrefix)) {
							throw new Error(`Invalid register prefix: ${arg}`)
						}

						// Validate value
						const value = Number(arg.slice(expectedPrefix.length))
						if (!(value >= 0 && value < regFile.count)) {
							throw new Error(`Invalid register index: ${value}`)
						}

						return [[argName, value]]
					} else if ('cache' in argDesc) {
						return []
					} else {
						throw new Error(`Unknown arg type: ${JSON.stringify(argDesc)}`)
					}
				})
				
				const localOpIndex = this._desc.groups[groupIndex][laneIndex].findIndex((op) => op === opIndex)
				if (localOpIndex === -1) {
					throw new Error(`Invalid opcode ${opcode} in group ${groupIndex} lane ${laneIndex}. Valid opcodes: ${this._desc.groups[groupIndex][laneIndex].map((op) => this._ops[op].opcode).join(', ')}`)
				}

				return {
					opcode: localOpIndex,
					args: Object.fromEntries(argValues),
				}
			})
		})

		return {
			groups,
		}
	}
}
