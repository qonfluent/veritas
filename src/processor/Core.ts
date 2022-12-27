import assert from 'assert'
import { Module, SignalDefStmt, Stmt } from '../hdl/Verilog'
import { createDecoder, DecoderDesc, OperationArgs } from './Decoder'

export type ArgDesc = { immediate: number } | { register: number }

export type OperationDesc = {
	opcode: string
	args: Record<string, ArgDesc>
	body: Stmt[]
}

export type CoreDesc = {
	decoders: {
		decoder: DecoderDesc
		streamBytes: number
	}[]

	operations: OperationDesc[]
}

export function getOperationArgs(operation: OperationDesc): OperationArgs {
	return { args: Object.fromEntries(Object.entries(operation.args).map(([name, arg]) => [name, 'immediate' in arg ? arg.immediate : arg.register])) }
}

export function createCore(name: string, desc: CoreDesc): Module {
	const decoders = desc.decoders.map((decoder, i) => createDecoder(`decoder_${i}`, decoder.decoder, desc.operations.map(getOperationArgs)))

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

			// Create decoder modules
			...decoders.map((module, i) => ({
				instance: `decoder_${i}`,
				module,
				ports: {
					clk: 'clk',
					rst: 'rst',

					instruction: { slice: `instruction_streams_${i}`, start: 0, end: module.body.find((stmt): stmt is SignalDefStmt => 'signal' in stmt && stmt.signal === 'instruction')!.width },
				},
			})),

			// Create operational units
			...desc.operations.map((operation, i) => ({
				instance: `operation_${i}`,
				module: {
					name: `operation_${i}`,
					body: operation.body,
				},
				ports: {
					clk: 'clk',
					rst: 'rst',
				},
			})),
		],
	}
}
