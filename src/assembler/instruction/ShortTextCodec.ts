import { Instruction } from '../../common/Assembly'
import { Codec } from '../../common/Codec'
import { DecoderDesc, OperationDesc, RegisterFileDesc, RegisterFileName } from '../../common/Processor'


export class ShortInstructionTextCodec implements Codec<Instruction, string> {
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
						if (!(value >= 0 && value < Math.pow(2, argDesc.immediateBits))) {
							throw new Error(`Invalid immediate value ${arg} tried to pack into ${argDesc.immediateBits} bits`)
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
