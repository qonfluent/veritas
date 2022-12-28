import { InstructionBytesCodec, InstructionTextCodec } from "../../src/assembler/InstructionCodec"

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

			console.log(encoded)
			expect(decoded).toEqual({ ...instruction, shiftBytes: 2 })
		}
	})
})
