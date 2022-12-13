import { SignalT, CombinationalLogic, GWModule, Signal, Edge, If, HIGH, Constant } from "gateware-ts"
import { DataType, typeToSignal } from "./Types"

export type ModuleDesc = {
	argTypes: DataType[]
	retTypes: DataType[]
}

export type ModuleBody = (inputs: SignalT[], outputs: SignalT[]) => CombinationalLogic[]

export type ModuleDescBody = ModuleDesc & {
	body: ModuleBody
}

export abstract class IModule extends GWModule {
	public clk = this.input(Signal())
	public rst = this.input(Signal())

	public stall = this.input(Signal())

	public moduleIns: SignalT[]
	public moduleOuts: SignalT[]

	public constructor(
		name: string,
		desc: ModuleDesc,
	) {
		super(name)

		this.moduleIns = desc.argTypes.map((type, i) => this.createInput(`module_in_${i}`, typeToSignal(type)))
		this.moduleOuts = desc.retTypes.map((type, i) => this.createOutput(`module_out_${i}`, typeToSignal(type)))
	}
}

export class BaseModule extends IModule {
	private _moduleLatches: SignalT[]
	private _body: ModuleBody

	public constructor(
		name: string,
		desc: ModuleDescBody,
	) {
		super(name, desc)

		this._moduleLatches = desc.retTypes.map((type, i) => this.createInternal(`module_latch_${i}`, typeToSignal(type)))
		this._body = desc.body
	}

	public describe(): void {
		this.combinationalLogic([
			...this._body(this.moduleIns, this._moduleLatches)
		])

		this.syncBlock(this.clk, Edge.Negative, [
			If(this.rst ['=='] (HIGH), [
				...this.moduleOuts.map((output) => output ['='] (Constant(output.width, 0))),
			]).Else([
				If(this.stall ['=='] (HIGH), [
					...this.moduleOuts.map((output) => output ['='] (output)),
				]).Else([
					...this.moduleOuts.map((output, i) => output ['='] (this._moduleLatches[i])),
				])
			])
		])
	}
}

export type PipelineDesc = {
	steps: ModuleDescBody[]
}

export class PipelineModule extends IModule {
	private _modules: BaseModule[]
	private _moduleIns: SignalT[][]
	private _moduleOuts: SignalT[][]

	public constructor(
		private readonly _name: string,
		private readonly _desc: PipelineDesc,
	) {
		super(_name, {
			argTypes: _desc.steps[0].argTypes,
			retTypes: _desc.steps[_desc.steps.length - 1].retTypes,
		})

		this._modules = _desc.steps.map((step, i) => new BaseModule(_name + `_${i}`, step))
		this._moduleIns = _desc.steps.map((step, i) => step.argTypes.map((type, j) => this.createInternal(`module_in_${i}_${j}`, typeToSignal(type))))
		this._moduleOuts = _desc.steps.map((step, i) => step.argTypes.map((type, j) => this.createInternal(`module_out_${i}_${j}`, typeToSignal(type))))
	}

	public describe(): void {
		// Add submodules and connect to _moduleIns and _moduleOuts
		this._modules.forEach((module, i) => {
			this.addSubmodule(module, this._name + `_${i}`, {
				inputs: {
					clk: this.clk,
					rst: this.rst,
					stall: this.stall,
					...Object.fromEntries(this._desc.steps[i].argTypes.map((_, j) => [`module_in_${j}`, this._moduleIns[i][j]])),
				},
				outputs: {
					...Object.fromEntries(this._desc.steps[i].retTypes.map((_, j) => [`module_out_${j}`, [this._moduleOuts[i][j]]])),
				},
			})
		})

		// Connect moduleIns to _moduleIns[0] and each stage to the previous one
		this.combinationalLogic([
			...this._moduleIns[0].map((input, i) => input ['='] (this.moduleIns[i])),
			...this._moduleIns.flatMap((inputs, i) => i === 0 ? [] : inputs.map((input, j) => input ['='] (this._moduleOuts[i - 1][j]))),
		])

		// Sync block
		this.syncBlock(this.clk, Edge.Negative, [
			If(this.rst ['=='] (HIGH), [
				// On reset, clear output latch
				...this.moduleOuts.map((output) => output ['='] (Constant(output.width, 0))),
			]).Else([
				If(this.stall ['=='] (HIGH), [
					// On stall, keep output state
					...this.moduleOuts.map((output) => output ['='] (output)),
				]).Else([
					// Else run output through pipeline
					...this.moduleOuts.map((output, i) => output ['='] (this._moduleOuts[this._moduleOuts.length - 1][i])),
				])
			])
		])
	}
}
