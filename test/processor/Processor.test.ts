import { CodeGenerator } from "gateware-ts"
import { DecoderModule } from "../../src/processor/Decoder"
import { DecoderTreeModule, OperationDesc } from "../../src/processor/DecoderTree"
import { BaseModule, PipelineDesc, PipelineModule } from "../../src/processor/Module"
import { ArgType, DataTag, DataType } from "../../src/processor/Types"

describe('Operational Unit', () => {
	it('Base Module', () => {
		const intType: DataType = { tag: DataTag.Int, signed: false, width: 32 }

		const test = new BaseModule('test', {
			argTypes: [intType, intType],
			retTypes: [intType],
			body: ([lhs, rhs], output) => [
				output[0] ['='] (lhs ['+'] (rhs)),
			],
		})

		const cg = new CodeGenerator(test)
		const verilog = cg.generateVerilogCodeForModule(test, false)
		console.log(verilog)
	})

	it('Pipelined Module', () => {
		const intType: DataType = { tag: DataTag.Int, signed: false, width: 32 }

		const desc: PipelineDesc = {
			steps: [
				{
					argTypes: [intType, intType],
					retTypes: [intType],
					body: ([lhs, rhs], output) => [
						output[0] ['='] (lhs ['+'] (rhs)),
					],
				},
				{
					argTypes: [intType],
					retTypes: [intType],
					body: ([input], output) => [
						output[0] ['='] (input ['+'] (input)),
					],
				},
			]
		}

		const test = new PipelineModule('test', desc)

		const cg = new CodeGenerator(test)
		const verilog = cg.generateVerilogCodeForModule(test, false)
		console.log(verilog)
	})

	it('Decoder tree', () => {
		const ops: OperationDesc[] = [
			{
				argTypes: [ArgType.Reg, ArgType.Reg],
			}
		]
		const test = new DecoderTreeModule('test', ops, [4])
	})

	it('Decoder', () => {
		const test = new DecoderModule('test', {
			shiftBits: 4,
			argSizes: [4],
			groups: [
				{
					lanes: [
						{
							ops: [0, 1, 2, 3],
						},
						{
							ops: [0, 1, 2, 3],
						},
						{
							ops: [0, 1, 2, 3],
						},
						{
							ops: [0, 1, 2, 3],
						},
					]
				},
				{
					lanes: [
						{
							ops: [0, 1, 2, 3],
						},
						{
							ops: [0, 1, 2, 3],
						},
					]
				},
				{
					lanes: [
						{
							ops: [0, 1, 2, 3],
						},
						{
							ops: [0, 1, 2, 3],
						},
					]
				}
			],
		}, [
			{
				argTypes: [ArgType.Reg, ArgType.Reg],
			},
			{
				argTypes: [],
			},
			{
				argTypes: [ArgType.Reg],
			},
			{
				argTypes: [ArgType.Reg, ArgType.Reg],
			},
		])

		const cg = new CodeGenerator(test)
		const verilog = cg.generateVerilogCodeForModule(test, false)
		console.log(verilog)
	})
})
