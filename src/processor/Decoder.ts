import assert from 'assert'
import { BlockStatement, CombinationalLogic, Edge, GWModule, HIGH, If, Signal, SignalLike, SignalT, Ternary } from 'gateware-ts'
import { DecoderGroupModule, DecoderGroupOutput } from './DecoderGroup'
import { DecoderDesc, OperationDesc } from './Description'
import { ArgInfoMap } from './Types'
import { reverseBits, clearRegs, maintainRegs } from './Utils'

type DecoderStepInternal = {
	laneCounts: SignalT[]
	instruction: SignalT
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

	private _steps: DecoderStepInternal[] = []

	private _laneCounts: SignalT[]

	private _headerSize: number

	public constructor(
		name: string,
		private readonly _desc: DecoderDesc,
		units: OperationDesc[],
		argInfo: ArgInfoMap,
	) {
		super(name)

		// Set up groups and IO
		this._groups = _desc.groups.map((group, i) => {
			const decoder = new DecoderGroupModule(`decoder_${i}`, group, units, argInfo)

			return {
				decoder,
				laneCount: this.createInternal(`lane_count_buf_${i}`, Signal(decoder.laneCount.width)),
				instruction: this.createInternal(`instruction_buf_${i}`, Signal(decoder.instruction.width)),
			}
		})

		// Calculate max instruction bytes
		this._headerSize = _desc.shiftBits + this._desc.groups.reduce((sum, { lanes }) => sum + Math.ceil(Math.log2(lanes.length)), 0)
		const bodySize = this._groups.reduce((sum, { decoder }) => sum + decoder.instruction.width, 0)
		const maxInstructionSize = this._headerSize + bodySize
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

		// Combinational logic
		this.combinationalLogic([
			...this.connectLaneCounts(),
			...this.connectGroupInputs(),
		])

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

	private connectLaneCounts(): CombinationalLogic[] {
		let index = this._desc.shiftBits
		
		return this._laneCounts.map((laneCount) => {
			const result = laneCount ['='] (this.instruction.slice(index, index + laneCount.width - 1))
			index += laneCount.width
			return result
		})
	}

	private connectGroupInputs(): CombinationalLogic[] {
		const logic: CombinationalLogic[] = []

		// Connect up group zero
		logic.push(
			this._groups[0].laneCount ['='] (this._laneCounts[0]),
			this._groups[0].instruction ['='] (this.instruction.slice(this._headerSize, this._headerSize + this._groups[0].instruction.width - 1)),
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

		return logic
	}

	private updateSteps(): BlockStatement[] {
		const block: BlockStatement[] = []

		// Handle lane counts
		for (let i = 1, step = 0; i < this._groups.length; i += 2, step++) {
			if (step === 0) {
				// Move lane counts forward in pipeline
				block.push(...this.forwardLaneCounts(this._laneCounts, this._steps[0], 1))
			} else {
				// Move lane counts forward in pipeline
				block.push(...this.forwardLaneCounts(this._steps[step - 1].laneCounts, this._steps[step], 2))
			}
		}

		// Handle instructions
		const headerSize = this._desc.shiftBits + this._desc.groups.reduce((sum, { lanes }) => sum + lanes.length, 0)
		for (let i = 1, step = 0; i < this._groups.length; i += 2, step++) {
			if (step === 0) {
				block.push(this.forwardInstruction(headerSize, this._laneCounts, i, this._steps[0].instruction, this.instruction))
			} else {
				block.push(this.forwardInstruction(this._groups[i - 2].instruction.width, this._steps[step - 1].laneCounts, i, this._steps[step].instruction, this._steps[step - 1].instruction))
			}
		}

		return block
	}

	private forwardLaneCounts(source: SignalT[], step: DecoderStepInternal, sliceSize: number): BlockStatement[] {
		const block: BlockStatement[] = []

		for (let i = 0; i < step.laneCounts.length - sliceSize; i++) {
			block.push(step.laneCounts[i] ['='] (source[i + sliceSize]))
		}

		return block
	}

	// i is an odd number [1, 3, 5, ...]
	private forwardInstruction(baseShift: number, laneCounts: SignalT[], i: number, targetIns: SignalT, sourceIns: SignalT): BlockStatement {
		let shiftDown = baseShift
		const shiftTable = this._groups[i - 1].decoder.laneWidths.map((laneWidth) => {
			shiftDown += laneWidth

			const currentLaneWidths = this._groups[i].decoder.laneWidths
			
			return currentLaneWidths.map((_, k) => {
				const shiftUp = currentLaneWidths.filter((_, l) => l >= k).reduce((sum, val) => sum + val, 0)
				const finalShift = shiftDown - shiftUp
				return this.shiftRightSignedDir(sourceIns, finalShift)
			})
		})
		
		return targetIns ['='] (this.indexTable2D(shiftTable, laneCounts))
	}

	private indexTable2D(table: SignalLike[][], indexes: SignalLike[]): SignalLike {
		assert(indexes.length >= 2)
		return this.indexTable1D(table.map((row) => this.indexTable1D(row, indexes[1])), indexes[0])
	}

	private indexTable1D(table: SignalLike[], index: SignalLike, i = 0): SignalLike {
		if (table.length === 1) {
			return table[0]
		}
		
		return Ternary(index ['=='] (i), table[0], this.indexTable1D(table.slice(1), index, i + 1))
	}

	private shiftRightSignedDir(source: SignalLike, shift: number): SignalLike {
		if (shift > 0) {
			return source ['>>'] (shift)
		} else if (shift < 0) {
			return source ['<<'] (-shift)
		} else {
			return source
		}
	}
}
