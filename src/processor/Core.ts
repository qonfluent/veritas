import assert from 'assert'
import { Module, SignalDefStmt } from '../hdl/Verilog'
import { createDecoder, DecoderDesc, OperationArgs } from './Decoder'

export type OperationDesc = OperationArgs

export type CoreDesc = {
	decoders: {
		decoder: DecoderDesc
		streamBytes: number
	}[]
	operations: OperationDesc[]
}

export function createCore(name: string, desc: CoreDesc): Module {
	const decoders = desc.decoders.map((decoder, i) => createDecoder(`decoder_${i}`, decoder.decoder, desc.operations))

	decoders.forEach((decoder, i) => {
		const instructionDef = decoder.body.find((stmt): stmt is SignalDefStmt => 'signal' in stmt && stmt.signal === 'instruction')
		assert(instructionDef !== undefined)
		assert(instructionDef.width <= desc.decoders[i].streamBytes * 8)
	})
	
	return {
		name,
		body: [
			{ signal: 'clk', width: 1, direction: 'input' },
			{ signal: 'rst', width: 1, direction: 'input' },

			...desc.decoders.map(({ streamBytes }, i) => ({ signal: `instruction_streams_${i}`, width: streamBytes * 8 })),

			// Decoder modules
			...decoders.map((module, i) => ({
				instance: `decoder_${i}`,
				module,
				ports: {
					clk: 'clk',
					rst: 'rst',

					instruction: { slice: { index: `instruction_streams_${i}`, start: i }, start: 0, end: module.body.find((stmt): stmt is SignalDefStmt => 'signal' in stmt && stmt.signal === 'instruction')!.width },
				},
			})),
		],
	}
}
