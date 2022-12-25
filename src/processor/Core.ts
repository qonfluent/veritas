import { Module, SignalDefStmt } from '../hdl/Verilog'
import { createDecoder, DecoderDesc, OperationArgs } from './Decoder'

export type OperationDesc = OperationArgs

export type CoreDesc = {
	decoders: DecoderDesc[]
	operations: OperationDesc[]
}

export function createCore(name: string, desc: CoreDesc): Module {
	const decoders = desc.decoders.map((decoder, i) => createDecoder(`decoder_${i}`, decoder, desc.operations))
	
	return {
		name,
		body: [
			{ signal: 'clk', width: 1, direction: 'input' },
			{ signal: 'rst', width: 1, direction: 'input' },

			// Decoder modules
			...decoders.map((module, i) => ({
				instance: `decoder_${i}`,
				module,
				ports: {
					clk: 'clk',
					rst: 'rst',

					instruction: { slice: `instruction_stream_${i}`, start: 0, end: module.body.find((stmt): stmt is SignalDefStmt => 'signal' in stmt && stmt.signal === 'instruction')!.width },
				},
			})),
		],
	}
}
