import assert from "assert"
import { decodeInstruction } from "../src/Instruction"
import { ArgMode, InstructionSetDesc, OpcodeDesc } from "../src/InstructionSet"
import { DataType, DataTypeTag, DataValue, typeEqual } from "../src/Types"

export interface Module<Input, Output> {
	step(value: Input): Output
}

export type FunctionalUnitInput = {
	args: DataValue[]
}

export type FunctionalUnitOutput = {
	results: DataValue[]
}

export class FunctionalUnit implements Module<FunctionalUnitInput, FunctionalUnitOutput> {
	private _cyclesRemaining: number = 0
	private readonly _queue: FunctionalUnitOutput[] = []

	public constructor(
		private readonly _desc: OpcodeDesc,
	) {}

	public step(value?: FunctionalUnitInput): FunctionalUnitOutput {
		if (this._cyclesRemaining > 0) {
			this._cyclesRemaining--
		}

		// Run step if needed
		if (value) {
			// Validate start latency is met
			assert(this._cyclesRemaining === 0)

			// Validate arg types
			assert(value.args.length === this._desc.argTypes.length)
			assert(value.args.every(({ type }, i) => typeEqual(type, this._desc.argTypes[i].type)))

			// Calculate results and enqueue
			const results = this._desc.body(value.args)
			assert(this._queue[this._desc.finishLatency] === undefined)
			this._queue[this._desc.finishLatency] = { results }

			// Set new cycles remaining
			this._cyclesRemaining = this._desc.startLatency
		}

		// Return output from queue
		const [result] = this._queue.splice(0, 1)
		return result
	}
}

export type DecoderInput = {
	instruction: Uint8Array
}

export type DecoderOutput = {
	shift: number
}

export class Decoder implements Module<DecoderInput, DecoderOutput> {
	public constructor(
		private readonly _desc: InstructionSetDesc,
	) {}

	public step(value: DecoderInput): DecoderOutput {
		const decoded = decodeInstruction(value.instruction, this._desc)

		return {
			shift: decoded.shift
		}
	}
}

describe('Processor', () => {
	it('Can create adder FU', () => {
		const adder = new FunctionalUnit({
			argTypes: [{ type: { tag: DataTypeTag.Int, signed: false, width: 32 }, mode: ArgMode.Reg },{ type: { tag: DataTypeTag.Int, signed: false, width: 32 }, mode: ArgMode.Reg }],
			startLatency: 1,
			finishLatency: 1,
			body: (args) => [{ type: { tag: DataTypeTag.Int, signed: false, width: 32 }, value: BigInt(args[0].value) + BigInt(args[1].value) }]
		})

		const r0 = adder.step({
			args: [
				{ type: { tag: DataTypeTag.Int, signed: false, width: 32 }, value: BigInt(1111) },
				{ type: { tag: DataTypeTag.Int, signed: false, width: 32 }, value: BigInt(2222) },
			],
		})
		expect(r0).toBe(undefined)

		const r1 = adder.step()
		expect(r1).toEqual({ results: [{ type: { tag: DataTypeTag.Int, signed: false, width: 32 }, value: BigInt(3333) }] })
	})
})
