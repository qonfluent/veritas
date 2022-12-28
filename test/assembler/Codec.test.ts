import { InstructionBytesCodec, InstructionTextCodec } from "../../src/assembler/InstructionCodec"
import { rangeMap } from "../../src/common/Util"
import { randomDecoderDesc, randomInstruction, randomOperationDesc } from "../Common"

describe('Instruction codec', () => {
	it('should encode and decode instructions', () => {
		const desc = {
			groups: [
				[
					[0, 1, 2, 3],
					[0, 1, 2, 3],
				],
			]
		}

		const binaryArgs = {
			lhs: {
				registerFile: 'belt',
			},
			rhs: {
				registerFile: 'belt',
			},
		}

		const ops = [
			{
				opcode: 'add',
				args: binaryArgs,
			},
			{
				opcode: 'sub',
				args: binaryArgs,
			},
			{
				opcode: 'mul',
				args: binaryArgs,
			},
			{
				opcode: 'div',
				args: binaryArgs,
			},
		]

		const registerFiles = {
			belt: {
				prefix: 'r',
				count: 64,
				widthBits: 64,
			}
		}

		const instruction = {
			groups: [
				[
					{
						opcode: 0,
						args: {
							lhs: 0,
							rhs: 1,
						},
					},
					{
						opcode: 1,
						args: {
							lhs: 2,
							rhs: 3,
						},
					},
				],
			],
		}

		{
			const codec = new InstructionTextCodec(desc, ops, registerFiles)
			const encoded = codec.encode(instruction)
			const decoded = codec.decode(encoded)

			expect(decoded).toEqual(instruction)
		}
		
		{
			const codec = new InstructionBytesCodec(desc, ops, registerFiles)
			const encoded = codec.encode(instruction)
			const decoded = codec.decode(encoded)

			expect(decoded).toEqual({ ...instruction, shiftBytes: 2 })
		}
	})

	it('Can encode and decode random instructions', () => {
		const ops = rangeMap(16, (i) => randomOperationDesc(`op_${i}`, 1, 32))
		const desc = randomDecoderDesc(1, 1, 16, ops.length)
		const registerFiles = {}
		const textCodec = new InstructionTextCodec(desc, ops, registerFiles)
		const bytesCodec = new InstructionBytesCodec(desc, ops, registerFiles)

		const TEST_COUNT = 10_000
		for (let i = 0; i < TEST_COUNT; i++) {
			const instruction = randomInstruction(desc, ops, registerFiles)
			const encoded = textCodec.encode(instruction)
			const decoded = textCodec.decode(encoded)
			expect(decoded).toEqual(instruction)

			const encodedBytes = bytesCodec.encode(instruction)
			const decodedBytes = bytesCodec.decode(encodedBytes)
			expect(decodedBytes).toEqual({ ...instruction, shiftBytes: bytesCodec.encodedBytes(instruction) })
		}
	})
})
