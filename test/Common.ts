import assert from 'assert'
import { ShortInstruction } from '../src/common/Assembly'
import { OpcodeName, OperationDesc, RegisterFileDesc, RegisterFileName, ShortDecoderDesc } from '../src/common/Processor'
import { rangeMap } from '../src/common/Util'

export function randomDecoderDesc(groupCount: number, maxLaneCount: number, maxOpCount: number, opcodeCount: number): ShortDecoderDesc {
	let index = 0
	const groups = rangeMap(groupCount, () => {
		return rangeMap(Math.floor(Math.random() * maxLaneCount) + 1, () => {
			return rangeMap(Math.floor(Math.random() * maxOpCount) + 1, () => {
				assert(index < opcodeCount, `Need at least ${groupCount * maxLaneCount * maxOpCount} opcodes for this decoder`)

				return index++
			})
		})
	})

	return { groups }
}

export function randomOperationDesc(opcode: OpcodeName, maxArgs: number, maxArgBits: number): OperationDesc {
	return {
		opcode,
		args: maxArgs === 0 ? {} : Object.fromEntries(rangeMap(Math.floor(Math.random() * (maxArgs + 1)), (i) => {
			return [`arg_${i}`, { immediateBits: Math.floor(Math.random() * (maxArgBits + 1)) }]
		}))
	}
}

export function randomInstruction(desc: ShortDecoderDesc, ops: OperationDesc[], registerFiles: Record<RegisterFileName, RegisterFileDesc>): ShortInstruction {
	return {
		groups: desc.groups.map((lanes) => {
			const laneCount = Math.floor(Math.random() * lanes.length) + 1
			return rangeMap(laneCount, (laneIndex) => {
				const laneOps = lanes[laneIndex]
				const opIndex = Math.floor(Math.random() * laneOps.length)
				const op = ops[laneOps[opIndex]]

				return {
					opcode: opIndex,
					args: Object.fromEntries(Object.entries(op.args).flatMap(([name, arg]) => {
						if ('immediateBits' in arg) {
							return [[name, Math.floor(Math.random() * Math.pow(2, arg.immediateBits))]]
						} else if ('registerFile' in arg) {
							const registerFile = registerFiles[arg.registerFile]
							return [[name, Math.floor(Math.random() * registerFile.count)]]
						} else if ('cache' in arg) {
							return []
						}

						throw new Error(`Unknown arg type: ${JSON.stringify(arg)}`)
					}))
				}
			})
		})
	}
}
