import { WideInstruction } from '../../common/Assembly'
import { Codec } from '../../common/Codec'
import { WideDecoderDesc, OperationDesc, RegisterFileDesc } from '../../common/Processor'

export class WideInstructionTextCodec implements Codec<WideInstruction, string> {
	public constructor(
		private readonly _desc: WideDecoderDesc,
		private readonly _ops: OperationDesc[],
		private readonly _registerFiles: Record<string, RegisterFileDesc>,
	) {}

	public encode(instruction: WideInstruction): string {
		throw new Error('Not implemented')
	}

	public decode(text: string): WideInstruction {
		throw new Error('Not implemented')
	}
}
