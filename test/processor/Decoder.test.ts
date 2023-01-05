import { rangeMap } from "../../src/common/Util"
import { moduleToVerilog } from "../../src/hdl/Verilog"
import { createShortDecoderModule } from "../../src/processor/ShortDecoder"
import { createDecoderTree, createDecoderTreeModule } from "../../src/processor/DecoderTree"
import { randomOperationDesc } from "../Common"

describe('Decoder Tree', () => {
	it('Can be created', () => {
		const groupCount = 1
		const laneCount = 1
		const opCount = 4
		const ops = rangeMap(groupCount * laneCount * opCount, (i) => randomOperationDesc(`op_${i}`, 1, 16))
		const registerFiles = {}
		
		const { tree, bits, argBits } = createDecoderTree(ops, registerFiles)

		const decoder = createDecoderTreeModule({
			tree,
			bits,
			argBits,
			count: ops.length,
		})

		const code = moduleToVerilog('test', decoder)
		console.log(code)
	})
})

describe('Short Decoder', () => {
	it('Can be created', () => {
		const groupCount = 1
		const laneCount = 1
		const opCount = 4
		const ops = rangeMap(groupCount * laneCount * opCount, (i) => randomOperationDesc(`op_${i}`, 1, 16))
		const registerFiles = {}

		const desc = {
			groups: [
				[createDecoderTree(ops, registerFiles)],
				[createDecoderTree(ops, registerFiles)],
				[createDecoderTree(ops, registerFiles)],
			]
		}

		const decoder = createShortDecoderModule(desc)

		const code = moduleToVerilog('test', decoder)
		console.log(code)
	})
})
