import { InstructionTextCodec } from "../../src/assembler/InstructionCodec"

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
			}
		]

		const registerFiles = {
			belt: {
				prefix: 'r',
				count: 64,
				widthBits: 64,
			}
		}

		const codec = new InstructionTextCodec(desc, ops, registerFiles)

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

		const encoded = codec.encode(instruction)
		const decoded = codec.decode(encoded)

		expect(decoded).toEqual(instruction)

		console.log(encoded)
	})
})
