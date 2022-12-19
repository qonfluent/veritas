import { GWModule, SignalT, Signal, SignalArrayT, SignalArray, Edge, If } from "gateware-ts"
import { ModuleDesc } from "./Description"
import { clearRegisters } from "./Utils"

export class BasicModule extends GWModule {
	// TODO: Remove these from modules that don't have a sync block
	public readonly clk: SignalT = this.input(Signal())
	public readonly rst: SignalT = this.input(Signal())

	public readonly inputPorts: Record<string, SignalT>
	public readonly outputPorts: Record<string, SignalT>

	private _state: Record<string, SignalT>
	private _arrays: Record<string, SignalArrayT>
	private _modules: Record<string, {
		module: BasicModule
		inputs: Record<string, SignalT>
		outputs: Record<string, SignalT[]>
	}>

	private _registers: string[]

	public constructor(
		name: string,
		private readonly _desc: ModuleDesc,
	) {
		super(name)

		this.inputPorts = Object.fromEntries(Object.entries(_desc.inputs ?? []).map(([name, width]) => [name, this.createInput(name, Signal(width))]))
		this.outputPorts = Object.fromEntries(Object.entries(_desc.outputs ?? []).map(([name, width]) => [name, this.createOutput(name, Signal(width))]))

		this._arrays = Object.fromEntries(Object.entries(_desc.arrays ?? []).map(([name, [width, depth]]) => [name, this.createInternal(name, SignalArray(width, depth))]))

		this._modules = Object.fromEntries(Object.entries(_desc.modules ?? []).map(([name, desc]) => {
			const module = desc instanceof BasicModule ? desc : new BasicModule(name, desc)

			const inputs = Object.fromEntries(Object.entries(module.inputPorts).map(([port, signal]) => [port, this.createInternal(`${name}_${port}`, Signal(signal.width))]))
			const outputs = Object.fromEntries(Object.entries(module.outputPorts).map(([port, signal]) => [port, [this.createInternal(`${name}_${port}`, Signal(signal.width))]]))
			return [name, { module, inputs, outputs }]
		}))

		this._state = Object.fromEntries([
			...Object.entries(this.inputPorts),
			...Object.entries(this.outputPorts),
			...Object.entries(_desc.internals ?? []).map(([name, width]) => [name, this.createInternal(name, Signal(width))]),
			...Object.entries(this._modules).flatMap(([name, { inputs, outputs }]) => [
				...Object.entries(inputs).map(([port, signal]) => [`${name}_${port}`, signal]),
				...Object.entries(outputs).map(([port, [signal]]) => [`${name}_${port}`, signal]),
			]),
		])

		this._registers = [
			..._desc.registers ?? [],
			...((_desc.registerOutputs ?? false) ? Object.keys(this.outputPorts) : [])
		]
	}

	public describe(): void {
		Object.entries(this._modules).forEach(([name, { module, inputs, outputs }]) => {
			this.addSubmodule(module, name, {
				inputs: {
					clk: this.clk,
					rst: this.rst,
					...inputs,
				},
				outputs,
			})
		})

		const logic = this._desc.logic(this._state, this._arrays)
		this.combinationalLogic(logic.logic)
		if (logic.state !== undefined) {
			this.syncBlock(this.clk, Edge.Negative, [
				If(this.rst, clearRegisters(this._registers.map((name) => this._state[name]))).Else(logic.state)
			])
		}
	}
}
