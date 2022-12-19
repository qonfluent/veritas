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

export type CacheDescHeader = {
	addressBits: number
	widthBytes: number // Power of two
	rows: number // Power of two
	ways: number
}

export type CacheDesc = CacheDescHeader & {
	readPorts: number
	writePorts: number
}

export type CachePortDesc = {
	read?: {
		streamBytes: number
	} | {
		maxDelay: number
		readWidthBytes: number[]
		retireStations: number
	},
	write?: {
		useTristate: boolean
	},
}

export type CacheControllerDesc = CacheDescHeader & {
	hasValidBits: boolean
	banking: number[]
	ports: CachePortDesc[]
}
