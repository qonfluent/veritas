import { randomInt } from "crypto"
import { CodeGenerator } from "gateware-ts"
import { CacheModule } from "../../src/processor/Cache"
import { DecoderModule } from "../../src/processor/Decoder"
import { ArgType, DecoderDesc, OperationDesc } from "../../src/processor/Description"

function randomOperation(): OperationDesc {
	return {
		inputs: Object.fromEntries([...Array(randomInt(5))].map((_, i) => [`${i}`, {
			type: ArgType.Immediate,
			width: randomInt(1, 11),
		}]))
	}
}

function randomDecoderDesc(): [DecoderDesc, OperationDesc[]] {
	const ops = [...Array(randomInt(16, 1025))].map(() => randomOperation())

	const result: DecoderDesc = {
		shiftBits: 6,
		groups: [...Array(3)].map(() => {
			return [...Array(4)].map(() => {
				return { ops: [...Array(16)].map(() => randomInt(ops.length)) }
			})
		})
	}

	return [result, ops]
}

describe('Processor', () => {
	it('Creates decoder', () => {
		const [desc, units] = randomDecoderDesc()
		const test = new DecoderModule('test', desc, units)

		const cg = new CodeGenerator(test)
		console.log(cg.toVerilog())
	})

	it.only('Creates cache', () => {
		const test = new CacheModule('test', {
			addressBits: 48,
			widthBytes: 64,
			rows: 1024,
			ways: 2,
			readPorts: 2,
			writePorts: 2,
		})

		const cg = new CodeGenerator(test)
		console.log(cg.toVerilog())
	})
})
