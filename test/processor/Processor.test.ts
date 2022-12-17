import { randomInt } from "crypto"
import { CodeGenerator } from "gateware-ts"
import { CacheModule } from "../../src/processor/Cache"
import { DecoderModule } from "../../src/processor/Decoder"
import { DecoderTreeModule } from "../../src/processor/DecoderTree"
import { OperationDesc, DecoderDesc, CacheDesc } from "../../src/processor/Description"
import { BaseModule, PipelineDesc, PipelineModule } from "../../src/processor/Module"
import { ArgHandler, ArgTag, ArgType, DataTag, DataType } from "../../src/processor/Types"

function randomOperationDesc(): OperationDesc {
	return {
		argTypes: [...Array(randomInt(5))].map(() => ({ tag: ArgTag.Reg, type: { tag: DataTag.Int, signed: false, width: 32 } })),
		retTypes: [],
	}
}

function randomDecoderDesc(opCount: number, opts?: { shiftBits: number, regSize: number }): DecoderDesc {
	return {
		shiftBits: opts?.shiftBits ?? randomInt(0, 7),
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
			argTypes: [{ tag: ArgTag.Reg, type: intType }, { tag: ArgTag.Reg, type: intType }],
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
					argTypes: [{ tag: ArgTag.Reg, type: intType }, { tag: ArgTag.Reg, type: intType }],
					retTypes: [intType],
					body: ([lhs, rhs], output) => [
						output[0] ['='] (lhs ['+'] (rhs)),
					],
				},
				{
					argTypes: [{ tag: ArgTag.Reg, type: intType }],
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
		const intType: DataType = { tag: DataTag.Int, signed: false, width: 32 }

		const ops: OperationDesc[] = [...Array(randomInt(1, 65))].map(() => randomOperationDesc())
		const test = new DecoderTreeModule('test', ops, [{ argBits: 4, handler: ArgHandler.Immediate }])

		const cg = new CodeGenerator(test)
		const verilog = cg.generateVerilogCodeForModule(test, false)
		console.log(verilog)
	})

	it('Decoder', () => {
		const units = [...Array(randomInt(10, 4097))].map(() => randomOperationDesc())
		const test = new DecoderModule('test', randomDecoderDesc(units.length), units, [{ argBits: randomInt(2, 17), handler: ArgHandler.Immediate }])

		const cg = new CodeGenerator(test)
		const verilog = cg.generateVerilogCodeForModule(test, false)
		console.log(verilog)
	})

	it.only('Cache', () => {
		const desc: CacheDesc = {
			addressBits: 48,
			widthBytes: 64,
			rows: 1024,
			readPorts: 2,
			writePorts: 2,
			ways: 4,
		}

		const test = new CacheModule('test', desc)

		const cg = new CodeGenerator(test)
		const verilog = cg.generateVerilogCodeForModule(test, false)
		console.log(verilog)
	})
})
