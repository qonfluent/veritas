import { Module } from '../hdl/Verilog'
import { createDecoder, DecoderDesc, OperationArgs } from './Decoder'

export type OperationDesc = OperationArgs

export type CoreDesc = {
	decoders: DecoderDesc[]
	operations: OperationDesc[]
}

export function createCore(name: string, desc: CoreDesc): Module {
	return {
		name,
		body: [
			{ signal: 'clk', width: 1, direction: 'input' },
			{ signal: 'rst', width: 1, direction: 'input' },

			// Decoder modules
			...desc.decoders.map((decoder, i) => ({
				instance: `decoder_${i}`,
				module: createDecoder(`decoder_${i}`, decoder, desc.operations),
				ports: {},
			})),
		],
	}
}
