import { SignalT, GWModule, Signal, Edge, If, HIGH } from "gateware-ts"
import { DecoderTreeModule } from "./DecoderTree"
import { DecoderGroupDesc, OperationDesc } from "./Description"
import { ArgInfoMap } from "./Types"
import { clearRegs, maintainRegs } from "./Utils"

export type DecoderGroupOutput = {
	valid: SignalT
	opcode: SignalT
	args: SignalT
}[]


export class DecoderGroupModule extends GWModule {
	public clk: SignalT = this.input(Signal())
	public rst: SignalT = this.input(Signal())

	public stall: SignalT = this.input(Signal())

	public laneCount: SignalT
	public instruction: SignalT

	public lanes: DecoderGroupOutput

	private _lanes: {
		decoder: DecoderTreeModule
		valid: SignalT
		opcode: SignalT
		args: SignalT
	}[]

	public constructor(
		name: string,
		private readonly _desc: DecoderGroupDesc,
		units: OperationDesc[],
		argInfo: ArgInfoMap,
	) {
		super(name)

		// Set up internal decoders
		const opcodeWidth = Math.ceil(Math.log2(units.length))
		this._lanes = _desc.lanes.map(({ ops }, i) => {
			const decoder = new DecoderTreeModule(`decoder_${i}`, ops.map((unit) => units[unit]), argInfo, opcodeWidth)

			return {
				decoder,
				valid: this.createInternal(`valid_buf_${i}`, Signal()),
				opcode: this.createInternal(`opcode_buf_${i}`, Signal(opcodeWidth)),
				args: this.createInternal(`args_buf_${i}`, Signal(decoder.args.width)),
			}
		})

		// Setup outputs
		this.laneCount = this.input(Signal(Math.ceil(Math.log2(_desc.lanes.length))))
		this.instruction = this.input(Signal(this.laneWidths.reduce((sum, width) => sum + width, 0)))

		this.lanes = _desc.lanes.map((_, i) => {
			return {
				valid: this.createOutput(`valid_${i}`, Signal()),
				opcode: this.createOutput(`opcode_${i}`, Signal(opcodeWidth)),
				args: this.createOutput(`args_${i}`, Signal(this._lanes[i].args.width)),
			}
		})
	}

	public get laneWidths(): number[] {
		return this._lanes.map(({ decoder }) => decoder.decodeInput.width)
	}

	public describe(): void {
		// Submodules
		let index = 0
		this._lanes.forEach(({ decoder, opcode, args }, i) => {
			this.addSubmodule(decoder, `decoder_${i}`, {
				inputs: {
					decodeInput: this.instruction.slice(index, index + decoder.decodeInput.width - 1),
				},
				outputs: {
					opcode: [opcode],
					args: [args],
				},
			})

			index += decoder.decodeInput.width
		})

		this.combinationalLogic([
			// Set up the valid signals on _lanes
			...this._lanes.map(({ valid }, i) => valid ['='] (this.laneCount ['>='] (i))),
		])

		const allRegs = this.lanes.flatMap(({ valid, opcode, args }) => [valid, opcode, args])
		this.syncBlock(this.clk, Edge.Negative, [
			If(this.rst ['=='] (HIGH), [
				...clearRegs(allRegs)
			]).Else([
				If(this.stall ['=='] (HIGH), [
					...maintainRegs(allRegs)
				]).Else([
					...this.lanes.flatMap(({ valid, opcode, args }, i) => [
						valid ['='] (this._lanes[i].valid),
						opcode ['='] (this._lanes[i].opcode),
						args ['='] (this._lanes[i].args),
					])
				])
			])
		])
	}
}
