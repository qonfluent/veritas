import { assert } from 'console'
import { WideInstruction } from '../../common/Assembly'
import { Codec } from '../../common/Codec'
import { OperationDesc, RegisterFileDesc } from '../../common/Processor'
import { clog2 } from '../../common/Util'
import { getArgCountBits, getMaxBodyBits, getOpcodeBits, WideDecoderDesc } from '../../processor/WideDecoder'

export class WideInstructionBytesCodec implements Codec<WideInstruction, Uint8Array> {
	private _shiftBits: number
	private _laneCountBits: number
	private _headerBits: number
	private _argCountBits: number[]
	private _opcodeBits: number[]

	public constructor(
		private readonly _desc: WideDecoderDesc,
		private readonly _ops: OperationDesc[],
		private readonly _registerFiles: Record<string, RegisterFileDesc>,
	) {
		this._shiftBits = clog2(getMaxBodyBits(_desc) / 8)
		this._laneCountBits = clog2(_desc.lanes.length)
		this._headerBits = this._shiftBits + this._laneCountBits
		this._argCountBits = getArgCountBits(_desc)
		this._opcodeBits = getOpcodeBits(_desc)
	}

	public encodedBytes(instruction: WideInstruction): number {
		assert(instruction.lanes.length >= 1 && instruction.lanes.length <= this._desc.lanes.length, 'Invalid lane count')

		// Total bits = header bits + body bits
		const bits = this._headerBits + instruction.lanes.reduce((sum, op, laneIndex) => {
			// Add up all the common bits for the lane
			const base = sum + this._argCountBits[laneIndex] + this._opcodeBits[laneIndex]

			// Load group
			const group = this._desc.groups[laneIndex]
			if ('split' in group) {
				return base + group.split.reduce((sum, entry) => {
					return sum + entry.width
				}, 0)
			} else {
				return base + (group.invertable ? 1 : 0) + Object.entries(op.args).reduce((sum, [name, value]) => {
					const arg = this._ops[op.opcode].args[name]
					
					return sum
				}, 0)
			}
		}, 0)

		return Math.ceil(bits / 8)
	}
	
	public encode(instruction: WideInstruction): Uint8Array {
		if (instruction.shiftBytes === undefined) {
			instruction.shiftBytes = this.encodedBytes(instruction)
		}

		throw new Error('Method not implemented.')
	}

	public decode(data: Uint8Array): WideInstruction {
		throw new Error('Method not implemented.')
	}
}
