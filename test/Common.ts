import { randomInt } from 'crypto'
import { Encoder, Instruction, Operation } from '../src/assembler/Encoder'
import { OperationArgs, DecoderDesc } from '../src/processor/Decoder'
import { recordRangeMap, rangeMap } from '../src/Util'

export function randomOperationArgs(maxArgBits: number, maxArgCount: number): OperationArgs {
	return { args: recordRangeMap(randomInt(maxArgCount + 1), (i) => [`arg_${i}`, randomInt(maxArgBits) + 1]) }
}

export function randomDecoderDesc(groups: number, maxLanes: number, maxOpsPerLane: number, operations: OperationArgs[]): DecoderDesc {
	return {
		groups: rangeMap(groups, () => {
			return rangeMap(randomInt(maxLanes) + 1, () => {
				return rangeMap(randomInt(maxOpsPerLane) + 1, () => randomInt(operations.length))
			})
		})
	}
}

export function randomEncoder(): Encoder {
	let opCount = 0
	const decoder: DecoderDesc = {
		groups: rangeMap(1, () => {
			return rangeMap(1, () => {
				return rangeMap(4, () => opCount++)
			})
		})
	}

	const ops = rangeMap(opCount, () => randomOperationArgs(10, 4))

	return new Encoder(decoder, ops)
}

export function randomOperation(opcode: number, argSpec: OperationArgs): Operation {
	return {
		opcode,
		args: Object.fromEntries(Object.entries(argSpec.args).map(([name, bits]) => [name, randomInt(2 ** bits)])),
	}
}

export function randomInstruction(encoder: Encoder): Instruction {
	return {
		groups: rangeMap(encoder.groupCount, (groupIndex) => {
			return rangeMap(encoder.getLaneCount(groupIndex), (laneIndex) => {
				const operations = encoder.operationArgs[groupIndex][laneIndex]
				const opcode = randomInt(operations.length)
				return randomOperation(opcode, operations[opcode])
			})
		})
	}
}
