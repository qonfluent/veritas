import { BitstreamWriter, BufferedWritable } from '@astronautlabs/bitstream'
import { DecoderTreeModule } from '../processor/DecoderTree'
import { DecoderDesc, OperationDesc } from '../processor/Description'
import { ArgData, ArgInfoMap } from '../processor/Types'

export type Operation = [number, ...ArgData[]]

export type OperationGroup = Operation[]

export type Instruction = OperationGroup[]

export class Assembler {
	private readonly _decoders: DecoderTreeModule[][]
	private readonly _headerLengths: number[]
	private readonly _opLengths: number[][]

	public constructor(
		private readonly _desc: DecoderDesc,
		units: OperationDesc[],
		argInfo: ArgInfoMap,
	) {
		this._decoders = _desc.groups.map(({ lanes }, i) => {
			return lanes.map(({ ops }, j) => {
				const decoder = new DecoderTreeModule(`decoder_${i}_${j}`, ops.map((unit) => units[unit]), argInfo, Math.ceil(Math.log2(units.length)))

				return decoder
			})
		})

		this._headerLengths = _desc.groups.map(({ lanes }) => Math.ceil(Math.log2(lanes.length)))

		this._opLengths = this._decoders.map((lanes) => {
			return lanes.map((decoder) => decoder.getMaxTotalWidth())
		})
	}

	public instructionLength(ins: Instruction): number {
		return 0
	}

	public encodeInstruction(ins: Instruction): Uint8Array {
		const buffer = new BufferedWritable()
		const result = new BitstreamWriter(buffer)

		// Write shift header
		// TODO: Subtract minimum value, add on decoder
		const shift = this.instructionLength(ins)
		result.write(this._desc.shiftBits, shift)

		// Write header for each group
		this._headerLengths.forEach((length, i) => {
			result.write(length, ins[i].length)
		})

		// Write args for each group/lane
		

		return buffer.buffer
	}
}