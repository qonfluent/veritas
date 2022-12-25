import { randomInt } from 'crypto'
import { Encoder, Instruction, Operation } from '../../src/assembler/Encoder'
import { DecoderDesc, OperationArgs } from '../../src/processor/Decoder'
import { rangeMap, recordRangeMap } from '../../src/Util'

function randomOperationArgs(maxArgBits: number, maxArgCount: number): OperationArgs {
	return { args: recordRangeMap(randomInt(maxArgCount + 1), (i) => [`arg_${i}`, randomInt(maxArgBits) + 1]) }
}	

function randomEncoder(): Encoder {
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

function randomOperation(opcode: number, argSpec: OperationArgs): Operation {
	return {
		opcode,
		args: Object.fromEntries(Object.entries(argSpec.args).map(([name, bits]) => [name, randomInt(2 ** bits)])),
	}
}

function randomInstruction(encoder: Encoder): Instruction {
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

describe('Assembler', () => {
	it('Can encode and decode instructions', () => {
		const encoder = randomEncoder()

		for (let i = 0; i < 100; i++) {
			const instruction = randomInstruction(encoder)
			const encoded = encoder.encodeInstruction(instruction)
			const decoded = encoder.decodeInstruction(encoded)
			expect(decoded).toEqual(instruction)
		}
	})
})
