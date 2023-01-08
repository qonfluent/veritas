import { ShortInstruction } from '../../common/Assembly'
import { Codec } from '../../common/Codec'
import { OperationDesc, RegisterFileDesc, ShortDecoderDesc } from '../../common/Processor'

export class ShortInstructionTextCodec implements Codec<ShortInstruction, string> {
	public constructor(
		private readonly _desc: ShortDecoderDesc,
		private readonly _ops: OperationDesc[],
		private readonly _registerFiles: Record<string, RegisterFileDesc>,
	) {}

	public encode(instruction: ShortInstruction): string {
		const result = instruction.groups.map((lanes, groupIndex) => {
			const result = lanes.map((opVal, laneIndex) => {
				const opcode: number = this._desc.groups[groupIndex][laneIndex][opVal.opcode]
				const opBase: OperationDesc = this._ops[opcode]
				const args = Object.entries(opBase.args).flatMap(([name, type]) => {
					const val = opVal.args[name]

					if ('immediateBits' in type) {
						return [`${val}`]
					} else if ('registerFile' in type) {
						const prefix = this._registerFiles[type.registerFile].prefix
						return [`${prefix}${val}`]
					}

					return []
				}).join(' ')
				
				return `${opBase.opcode} ${args}`
			})

			return `[${result.join(', ')}]`
		})

		return `[${result.join(', ')}]`
	}

	public decode(text: string): ShortInstruction {
		if (text[0] !== '[' || text[text.length - 1] !== ']') {
			throw new Error(`Invalid instruction: ${text}, must be wrapped in []`)
		}

		// Split into groups
		const groupsRaw = text.slice(1, text.length - 1).split('], [')

		if (groupsRaw.length !== this._desc.groups.length) {
			throw new Error(`Invalid instruction: ${text}, must have ${this._desc.groups.length} groups`)
		}

		const groups = groupsRaw.map((group, groupIndex) => {
			if (group[0] !== '[' || group[group.length - 1] !== ']') {
				throw new Error(`Invalid group: ${group}, must be wrapped in []`)
			}

			// Split into lanes
			const lanesRaw = group.slice(1, group.length - 1).split(', ')

			if (lanesRaw.length < 1 || lanesRaw.length > this._desc.groups[groupIndex].length) {
				throw new Error(`Invalid group: ${group}, must have between 1 and ${this._desc.groups[groupIndex].length} lanes`)
			}

			return lanesRaw.map((lane, laneIndex) => {
				const [opcode, ...args] = lane.split(' ')
				const opIndex = this._ops.findIndex((op) => op.opcode === opcode)
				const opBase = this._ops[opIndex]
				const selectIndex = this._desc.groups[groupIndex][laneIndex].findIndex((op) => op === opIndex)

				if (!opBase) {
					throw new Error(`Invalid opcode: ${opcode}, must be one of\n${this._ops.map((op) => op.opcode).join(', ')}`)
				}

				return {
					opcode: selectIndex,
					args: Object.fromEntries(Object.entries(opBase.args).flatMap(([name, type], index) => {
						const arg = args[index]

						if ('immediateBits' in type) {
							const result = parseInt(arg)

							if (!Number.isSafeInteger(result) || result < 0 || result >= 2 ** type.immediateBits) {
								throw new Error(`Invalid immediate: ${arg}, must be an integer between 0 and ${2 ** type.immediateBits - 1}`)
							}

							return [[name, result]]
						} else if ('registerFile' in type) {
							const file = this._registerFiles[type.registerFile]
							const prefix = file.prefix
							if (!arg.startsWith(prefix)) {
								throw new Error(`Invalid register: ${arg}, must start with ${prefix}`)
							}

							const result = parseInt(arg.slice(prefix.length))

							if (!Number.isSafeInteger(result) || result < 0 || result >= file.count) {
								throw new Error(`Invalid register: ${arg}, must be between ${prefix}0 and ${prefix}${file.count - 1}`)
							}

							return [[name, result]]
						}

						return []
					})),
				}
			})
		})

		return { groups }
	}
}
