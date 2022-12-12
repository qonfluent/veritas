import assert from "assert"
import { DataValue, DataType, CycleCount, RegisterIndex } from "./Types"

export enum ArgMode {
	Reg,
}

export type ModeSizeMap = { [K in ArgMode]: number }

export type ArgType = {
	type: DataType
	mode: ArgMode
}

export type ArgValueReg = {
	mode: ArgMode.Reg
	index: RegisterIndex
}

export type ArgValue = ArgValueReg

export type OperationDesc = {
	argTypes: ArgType[]
	resultTypes: DataType[]
	startLatency: CycleCount
	finishLatency: CycleCount
	body: (args: DataValue[]) => DataValue[]
}

export type OperationalUnitInput = {
	target: RegisterIndex
	args: DataValue[]
}

export type OperationalUnitOutput = {
	target: RegisterIndex
	result: DataValue[]
}

export class OperationalUnit {
	private readonly _results: OperationalUnitOutput[] = []
	private _startLatency: CycleCount = 0

	public constructor(
		private readonly _desc: OperationDesc,
	) {}

	public step(input?: OperationalUnitInput): OperationalUnitOutput | undefined {
		if (this._startLatency > 0) {
			this._startLatency--
		}

		if (input !== undefined) {
			assert(this._startLatency === 0)
			assert(input.args.length === this._desc.argTypes.length)
			assert(this._results[this._desc.finishLatency] === undefined)

			this._results[this._desc.finishLatency] = { target: input.target, result: this._desc.body(input.args) }
			this._startLatency = this._desc.startLatency
		}

		const [result] = this._results.splice(0, 1)
		return result
	}
}
