import { SignalT, SignalArrayT, CombinationalLogic, BlockStatement } from "gateware-ts"
import { BasicModule } from "./Module"

export type ModuleDesc = {
	inputs?: Record<string, number>
	outputs?: Record<string, number>
	internals?: Record<string, number>
	arrays?: Record<string, [number, number]>
	modules?: Record<string, ModuleDesc | BasicModule>
	registerOutputs?: boolean
	registers?: string[]
	logic: (state: Record<string, SignalT>, arrays: Record<string, SignalArrayT>) => {
		logic: CombinationalLogic[]
		state?: BlockStatement[]
	}
}

export enum ArgType {
	Immediate,
	Register,
}

export type ArgInfo = {
	type: ArgType
	width: number
}

export type OperationDesc = {
	inputs: Record<string, ArgInfo>
}

export type UnitIndex = number

export type DecoderTreeDesc = {
	ops: UnitIndex[]
}

export type DecoderDesc = {
	shiftBits: number
	groups: DecoderTreeDesc[][]
}

export type CacheDesc = {
	addressBits: number
	widthBytes: number
	rows: number
	ways: number
	readPorts: number
	writePorts: number
}