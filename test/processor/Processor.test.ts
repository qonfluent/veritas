import { randomInt } from 'crypto'
import { CodeGenerator } from 'gateware-ts'
import { CacheModule } from '../../src/processor/Cache'
import { CacheControllerModule } from '../../src/processor/CacheController'
import { DecoderModule } from '../../src/processor/Decoder'
import { DecoderTreeModule } from '../../src/processor/DecoderTree'
import { OperationDesc, DecoderDesc, CacheDesc, CacheControllerDesc } from '../../src/processor/Description'
import { ArgHandler, ArgTag, DataTag } from '../../src/processor/Types'

function randomOperationDesc(): OperationDesc {
	return {
		opcode: 'op',
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
	it('Decoder tree', () => {
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

	it('Cache', () => {
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

	it.only('Cache controller', () => {
		const cacheDesc: CacheControllerDesc = {
			addressBits: 48,
			widthBytes: 64,
			rows: 1024,
			readPorts: 2,
			writePorts: [false],
			ways: 4,
		}

		const test = new CacheControllerModule('test', cacheDesc)

		const cg = new CodeGenerator(test)
		const verilog = cg.generateVerilogCodeForModule(test, false)
		console.log(verilog)
	})
})
