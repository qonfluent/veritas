import { BlockStatement, Case, CombinationalLogic, Edge, GWModule, HIGH, If, Signal, SignalLikeOrValue, SignalT, SubjectiveCaseStatement, Switch } from 'gateware-ts'
import { DecoderGroupDesc, DecoderGroupModule, DecoderGroupOutput } from './DecoderGroup'
import { OperationDesc } from './DecoderTree'
import { ArgSizeMap } from './Types'
import { reverseBits, clearRegs, maintainRegs } from './Utils'

export type DecoderDesc = {
	shiftBits: number
	argSizes: ArgSizeMap
	groups: DecoderGroupDesc[]
}

export class DecoderModule extends GWModule {
	public clk: SignalT = this.input(Signal())
	public rst: SignalT = this.input(Signal())

	public stall: SignalT = this.input(Signal())

	public instruction: SignalT

	public shiftBytes: SignalT
	public groups: DecoderGroupOutput[]

	private _groups: {
		decoder: DecoderGroupModule
		laneCount: SignalT
		instruction: SignalT
	}[]

	private _steps: {
		laneCounts: SignalT[]
		instruction: SignalT
	}[] = []

	private _laneCounts: SignalT[]

	public constructor(
		name: string,
		private readonly _desc: DecoderDesc,
		units: OperationDesc[],
	) {
		super(name)

		// Set up groups and IO
		this._groups = _desc.groups.map((group, i) => {
			const decoder = new DecoderGroupModule(`decoder_${i}`, group, units, _desc.argSizes)

			return {
				decoder,
				laneCount: this.createInternal(`lane_count_buf_${i}`, Signal(decoder.laneCount.width)),
				instruction: this.createInternal(`instruction_buf_${i}`, Signal(decoder.instruction.width)),
			}
		})

		// Calculate max instruction bytes
		const headerSize = _desc.shiftBits + this._desc.groups.reduce((sum, { lanes }) => sum + Math.ceil(Math.log2(lanes.length)), 0)
		const bodySize = this._groups.reduce((sum, { decoder }) => sum + decoder.instruction.width, 0)
		const maxInstructionSize = headerSize + bodySize
		const maxInstructionBytes = Math.ceil(maxInstructionSize / 8)

		// Set up IO
		this.instruction = this.input(Signal(maxInstructionBytes * 8))
		this.shiftBytes = this.output(Signal(Math.ceil(Math.log2(maxInstructionBytes))))
		this.groups = this._groups.map(({ decoder }, i) => {
			return decoder.lanes.map(({ opcode, args }, j) => {
				return {
					valid: this.createOutput(`valid_${i}_${j}`, Signal()),
					opcode: this.createOutput(`opcode_${i}_${j}`, Signal(opcode.width)),
					args: this.createOutput(`args_${i}_${j}`, Signal(args.width)),
				}
			})
		})

		// Set up steps
		for (let i = 1, step = 0; i < this._groups.length; i += 2, step++) {
			this._steps.push({
				laneCounts: [...Array(this._groups.length - i)].map((_, j) => this.createInternal(`step_lane_count_${step}_${j}`, Signal(this._groups[i + j].laneCount.width))),
				instruction: this.createInternal(`step_ins_${step}`, Signal(this._groups[i].instruction.width + (this._groups[i + 1]?.instruction.width ?? 0))),
			})
		}

		this._laneCounts = this._groups.map(({ laneCount }, i) => this.createInternal(`lane_count_${i}`, Signal(laneCount.width)))
	}

	public describe(): void {
		// Submodules
		this._groups.forEach(({ decoder, laneCount, instruction }, i) => {
			this.addSubmodule(decoder, `decoder_${i}`, {
				inputs: {
					clk: this.clk,
					rst: this.rst,
					stall: this.stall,

					laneCount,
					instruction,
				},
				outputs: Object.fromEntries(decoder.lanes.flatMap((_, j) => [
					[`valid_${j}`, [this.groups[i][j].valid]],
					[`opcode_${j}`, [this.groups[i][j].opcode]],
					[`args_${j}`, [this.groups[i][j].args]],
				])),
			})
		})

		// Combinational block
		const logic: CombinationalLogic[] = []

		// Connect up lane counts
		let index = this._desc.shiftBits
		logic.push(...this._laneCounts.map((laneCount) => {
			const result = laneCount ['='] (this.instruction.slice(index, index + laneCount.width - 1))
			index += laneCount.width
			return result
		}))

		// Connect up group zero
		logic.push(
			this._groups[0].laneCount ['='] (this._laneCounts[0]),
			this._groups[0].instruction ['='] (this.instruction.slice(index, index + this._groups[0].instruction.width - 1)),
		)

		// Connect up remaining groups
		for (let i = 1, step = 0; i < this._groups.length; i += 2, step++) {
			const lowHalfSize = this._groups[i].instruction.width
			logic.push(
				this._groups[i].laneCount ['='] (this._steps[step].laneCounts[0]),
				this._groups[i].instruction ['='] (reverseBits(this._steps[step].instruction.slice(0, lowHalfSize - 1))),
			)

			if (i + 1 < this._groups.length) {
				logic.push(
					this._groups[i + 1].laneCount ['='] (this._steps[step].laneCounts[1]),
					this._groups[i + 1].instruction ['='] (this._steps[step].instruction.slice(lowHalfSize, this._steps[step].instruction.width - 1)),
				)
			}
		}

		this.combinationalLogic(logic)

		// Sync block
		const allRegs = [this.shiftBytes]
		this.syncBlock(this.clk, Edge.Negative, [
			If(this.rst ['=='] (HIGH), [
				...clearRegs(allRegs)
			]).Else([
				If(this.stall ['=='] (HIGH), [
					...maintainRegs(allRegs)
				]).Else([
					this.shiftBytes ['='] (this.instruction.slice(0, this._desc.shiftBits - 1)),
					...this.updateSteps()
				])
			])
		])
	}

	private updateSteps(): BlockStatement[] {
		const block: BlockStatement[] = []

		// Handle every step
		const headerSize = this._desc.shiftBits + this._desc.groups.reduce((sum, { lanes }) => sum + lanes.length, 0)
		for (let i = 1, step = 0; i < this._groups.length; i += 2, step++) {
			if (step === 0) {
				// Move lane counts forward in pipeline
				for (let j = 0; j < this._groups.length - 1; j++) {
					block.push(this._steps[0].laneCounts[j] ['='] (this._laneCounts[j + 1]))
				}

				// Move instructions forward in the pipeline
				let shiftDown = headerSize
				block.push(
					Switch(this._laneCounts[0], this._groups[0].decoder.laneWidths.map((laneWidth, i) => {
						shiftDown += laneWidth

						return Case(i, [
							Switch(this._laneCounts[1], this._groups[1].decoder.laneWidths.flatMap((_, j) => {
								const shiftUp = this._groups[1].decoder.laneWidths.filter((_, k) => k >= j).reduce((sum, val) => sum + val, 0)
								const finalShift = shiftDown - shiftUp
								return this.shiftSignedDir(this._steps[0].instruction, this.instruction, j, finalShift)
							}))
						])
					}))
				)
			} else {
				// Move lane counts forward in pipeline
				for (let j = 0; j < this._steps[step - 1].laneCounts.length - 2; j++) {
					block.push(this._steps[step].laneCounts[j] ['='] (this._steps[step - 1].laneCounts[j + 2]))
				}

				// Move instructions forward in the pipeline
				let shiftDown = this._groups[i - 2].instruction.width
				block.push(
					Switch(this._steps[step - 1].laneCounts[0], this._groups[i - 1].decoder.laneWidths.map((laneWidth, i) => {
						shiftDown += laneWidth

						return Case(i, [
							Switch(this._steps[step - 1].laneCounts[1], this._groups[i].decoder.laneWidths.map((_, j) => {
								const shiftUp = this._groups[i].decoder.laneWidths.filter((_, k) => k >= j).reduce((sum, val) => sum + val, 0)
								const finalShift = shiftDown - shiftUp
								return this.shiftSignedDir(this._steps[step].instruction, this._steps[step - 1].instruction, j, finalShift)
							}))
						])
					}))
				)
			}
		}

		return block
	}

	private shiftSignedDir(target: SignalT, source: SignalT, sel: SignalLikeOrValue, shift: number): SubjectiveCaseStatement {
		if (shift > 0) {
			return Case(sel, [
				target ['='] (source ['>>'] (shift))
			])
		} else if (shift < 0) {
			return Case(sel, [
				target ['='] (source ['<<'] (-shift))
			])
		} else {
			return Case(sel, [
				target ['='] (source)
			])
		}	
	}
}
