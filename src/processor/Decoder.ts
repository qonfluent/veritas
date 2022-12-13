import assert from "assert"
import { GWModule, SignalT, Signal, CombinationalLogic, Edge, HIGH, If, Constant, LOW, SignalLike } from "gateware-ts"
import { DecoderTreeModule, OperationDesc, UnitIndex } from "./DecoderTree"
import { ArgSizeMap } from "./Types"

export type DecoderGroupDesc = {
	lanes: {
		ops: UnitIndex[]
	}[]
}

export type DecoderDesc = {
	shiftBits: number
	argSizes: ArgSizeMap
	groups: DecoderGroupDesc[]
}

export class DecoderModule extends GWModule {
	// IO interface
	public clk: SignalT = this.input(Signal())
	public rst: SignalT = this.input(Signal())
	
	public stall: SignalT = this.input(Signal())

	public instruction: SignalT
	public shiftBytes: SignalT
	public groups: {
		valid: SignalT
		opcode: SignalT
		args: SignalT
	}[][]

	// Submodules
	private _decoders: {
		decoder: DecoderTreeModule
		input: SignalT
		opcode: SignalT
		args: SignalT
	}[][]

	// Registers
	private _steps: {
		shiftBits: SignalT[]
		instruction: SignalT
	}[]

	// Wires
	private _laneCounts: SignalT[]
	private _shiftBitsLogic: SignalT[]

	// Misc
	private _groupSize: number[]

	public constructor(
		name: string,
		private readonly _desc: DecoderDesc,
		private readonly _units: OperationDesc[],
	) {
		super(name)

		// Set up instruction input
		const maxInstructionBytes = this.getMaxInstructionBytes()
		this.instruction = this.input(Signal(8 * maxInstructionBytes))

		// Set up shift and buffer
		const shiftWidth = Math.ceil(Math.log2(maxInstructionBytes))
		this.shiftBytes = this.output(Signal(shiftWidth))

		// Set up group outputs
		this.groups = _desc.groups.map((group, i) => {
			return group.lanes.map((_, j) => {
				return {
					valid: this.createOutput(`valid_${i}_${j}`, Signal()),
					opcode: this.createOutput(`opcode_${i}_${j}`, Signal()),
					args: this.createOutput(`args_${i}_${j}`, Signal()),
				}
			})
		})

		// Set up decoders and dummy wiring
		this._decoders = _desc.groups.map((group, i) => {
			return group.lanes.map(({ ops }, j) => {
				const opcodeWidth = undefined
				const decoder = new DecoderTreeModule(`decoder_tree_${i}_${j}`, ops.map((unit) => _units[unit]), _desc.argSizes, opcodeWidth)

				return {
					decoder,
					input: this.createInternal(`decoder_tree_input_${i}_${j}`, Signal(decoder.decodeInput.width)),
					opcode: this.createInternal(`decoder_tree_opcode_${i}_${j}`, Signal(decoder.opcode.width)),
					args: this.createInternal(`decoder_tree_args_${i}_${j}`, Signal(decoder.args.width)),
				}
			})
		})

		// Set up step registers
		const stepCount = Math.ceil((_desc.groups.length - 1) / 2)
		this._steps = [...Array(stepCount)].map((_, i) => ({
			// TODO: Some savings by using narrower types, but the optimizer should take care of it
			instruction: this.createInternal(`step_ins_${i}`, Signal(this.instruction.width)),
			shiftBits: [...Array(stepCount - i)].map((_, j) => this.createInternal(`shift_bits_${i}_${j}`, Signal(Math.ceil(Math.log2(this.instruction.width))))),
		}))

		// Set up lane count registers
		this._laneCounts = _desc.groups.map((group, i) => this.createInternal(`lane_count_${i}`, Signal(Math.ceil(Math.log2(group.lanes.length)))))

		// Get group sizes
		this._groupSize = _desc.groups.map((group, i) => {
			// Get group size
			const size = this._decoders[i][0].decoder.getMaxTotalWidth()

			// Validate all lanes match
			// NOTE: We could just add each lane's width up as well, but that's not really the point of lanes
			assert(group.lanes.every(((_, j) => this._decoders[i][j].decoder.getMaxTotalWidth() === size)))

			return size
		})

		// Set up wires to hold the shift bits logic results
		this._shiftBitsLogic = [...Array(stepCount)].map((_, i) => this.createInternal(`shift_bits_logic_${i}`, Signal(Math.ceil(Math.log2(this.instruction.width)))))
	}

	public describe(): void {
		// Add decoder tree modules and wiring
		this._decoders.forEach((lanes, i) => {
			lanes.forEach(({ decoder, input, opcode, args }, j) => {
				this.addSubmodule(decoder, `decoder_tree_${i}_${j}`, {
					inputs: {
						decodeInput: input,
					},
					outputs: {
						opcode: [opcode],
						args: [args],
					},
				})
			})
		})

		// Set up combinatorial logic
		const logic: CombinationalLogic[] = []
		let index = this._desc.shiftBits

		// Extract lane counts
		this._desc.groups.forEach((group, i) => {
			const bits = Math.ceil(Math.log2(group.lanes.length))
			if (bits === 0) {
				logic.push(this._laneCounts[i] ['='] (Constant(undefined, 0)))
			} else {
				logic.push(this._laneCounts[i] ['='] (this.instruction.slice(index, index + bits - 1)))
				index += bits
			}
		})

		// Calculate shifts
		for (let i = 0; i < this._steps.length; i++) {
			if (i === 0) {
				const lhs = Constant(this._shiftBitsLogic[0].width, index) ['+'] (this.fixedMultiplier(this._laneCounts[0], this._groupSize[0]))
				const rhs = this.fixedMultiplier(this._laneCounts[1], this._groupSize[1])
				logic.push(this._shiftBitsLogic[0] ['='] (lhs ['+'] (rhs)))
			} else {
				const lhs = this.fixedMultiplier(this._laneCounts[2 * i], this._groupSize[2 * i])
				const rhs = this.fixedMultiplier(this._laneCounts[2 * i + 1], this._groupSize[2 * i + 1])
				logic.push(this._shiftBitsLogic[i] ['='] (lhs ['+'] (rhs)))
			}
		}

		// Connect input to group zero directly
		this._decoders[0].forEach((decoder) => {
			const bits = decoder.input.width
			logic.push(decoder.input ['='] (this.instruction.slice(index, index + bits - 1)))
			index += bits
		})

		this.combinationalLogic(logic)

		// Add sync block
		this.syncBlock(this.clk, Edge.Negative, [
			If(this.rst ['=='] (HIGH), [
				// During reset, set all registers to zero
				this.shiftBytes ['='] (Constant(this.shiftBytes.width, 0)),
				...this.groups.flatMap((group) => group.flatMap(({ valid, opcode, args }) => [
					valid ['='] (LOW),
					opcode ['='] (Constant(opcode.width, 0)),
					args ['='] (Constant(args.width, 0)),
				])),
			]).Else([
				If(this.stall ['=='] (HIGH), [
					// During stall, keep all registers the same
					this.shiftBytes ['='] (this.shiftBytes),
					...this.groups.flatMap((group) => group.flatMap(({ valid, opcode, args }) => [
						valid ['='] (valid),
						opcode ['='] (opcode),
						args ['='] (args),
					])),
				]).Else([
					// During normal operation, update registers as required
					this.shiftBytes ['='] (this.instruction.slice(0, this._desc.shiftBits - 1)),
					...this.groups.flatMap((group, i) => group.flatMap(({ valid, opcode, args }, j) => [
						valid ['='] (this._laneCounts[i] ['>='] (Constant(this._laneCounts[0].width, j))),
						opcode ['='] (this._decoders[i][j].opcode),
						args ['='] (this._decoders[i][j].args),
					])),
				])
			]),
		])
	}

	private getMaxInstructionBytes(): number {
		// Get number of header bits
		const headerBits = this._desc.shiftBits + this._desc.groups.reduce((accum, val) => accum + Math.ceil(Math.log2(val.lanes.length)), 0)

		// Get group arg sizes
		const groupArgBits = this._desc.groups.map((group) => {
			// Get max from all lanes in the group
			return group.lanes.reduce((max, { ops }) => {
				// Get max of all ops
				const maxArgs = ops.reduce((max, unit) => {
					// Get total size of args for this op(by lookin up unit)
					const opSize = this._units[unit].argTypes.reduce((sum, type) => sum + this._desc.argSizes[type], 0)

					// Return max
					return max > opSize ? max : opSize
				}, 0)

				// Return max
				return max > maxArgs ? max : maxArgs
			}, 0)
		})

		// Calculate max instruction bytes
		const maxInstructionBytes = Math.ceil((headerBits + groupArgBits.reduce((accum, val) => accum + val, 0)) / 8)

		return maxInstructionBytes
	}

	private fixedMultiplier(value: SignalT, mul: number): SignalLike {
		const partials: SignalLike[] = []
		while (mul > 0) {
			const base = Math.floor(Math.log2(mul))
			mul -= Math.pow(2, base)

			partials.push(value ['<<'] (base))
		}

		return partials.reduce((accum, val) => val ['+'] (accum))
	}
}
