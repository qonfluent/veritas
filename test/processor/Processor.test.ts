import { randomInt } from "crypto"
import { CodeGenerator } from "gateware-ts"
import { DecoderDesc, DecoderModule } from "../../src/processor/Decoder"
import { DecoderTreeModule, OperationDesc } from "../../src/processor/DecoderTree"
import { BaseModule, PipelineDesc, PipelineModule } from "../../src/processor/Module"
import { ArgType, DataTag, DataType } from "../../src/processor/Types"

function randomOperationDesc(): OperationDesc {
	return {
		argTypes: [...Array(randomInt(5))].map(() => ArgType.Reg)
	}
}

function randomDecoderDesc(opCount: number, opts?: { shiftBits: number, regSize: number }): DecoderDesc {
	return {
		shiftBits: opts?.shiftBits ?? randomInt(0, 7),
		argSizes: [opts?.regSize ?? randomInt(2, 17)],
		groups: [...Array(randomInt(1, 17))].map(() => ({
			lanes: [...Array(randomInt(1, 17))].map(() => ({
				ops: [...Array(randomInt(1, 1025))].map(() => randomInt(opCount)),
			}))
		})),
	}
}

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

		const cg = new CodeGenerator(test)
		const verilog = cg.generateVerilogCodeForModule(test, false)
		console.log(verilog)
	})

	it.only('Decoder', () => {
		const units = [...Array(randomInt(10, 4097))].map(() => randomOperationDesc())
		const test = new DecoderModule('test', randomDecoderDesc(units.length), units)

		const cg = new CodeGenerator(test)
		const verilog = cg.generateVerilogCodeForModule(test, false)
		console.log(verilog)
	})
})
