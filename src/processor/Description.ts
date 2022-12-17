import { CombinationalLogic, SignalT } from "gateware-ts"
import { ArgInfoMap, ArgType, DataType } from "./Types"

// Index types to refer to parts of the processor
export type UnitIndex = number
export type LaneIndex = number
export type GroupIndex = number
export type DecoderIndex = number
export type CoreIndex = number
export type DeviceIndex = number

// Each unit is described with an operation desc
// Arg type tag describes instruction encoding, type describes data encoding
export type OperationDesc = {
	argTypes: ArgType[]
	retTypes: DataType[]
	caches?: {
		widthBytes: number
	}[]
}

export type OperationBody = (inputs: SignalT[], outputs: SignalT[]) => CombinationalLogic[]

export type OperationDescBody = OperationDesc & {
	body: OperationBody
}

// Units are combined into groups, where each group has a number of lanes
// Each lane connects to a number of functional units
export type DecoderGroupDesc = {
	lanes: {
		ops: UnitIndex[]
	}[]
}

// A number of groups along with some book keeping information form a decoder
export type DecoderDesc = {
	shiftBits: number
	groups: DecoderGroupDesc[]
}

// A cache has a certain width per row, a number of rows, and a number of ways
// Total size = widthBytes * rows * ways
export type CacheDescHeader = {
	addressBits: number
	widthBytes: number
	rows: number
	ways: number
}

export type CacheDesc = CacheDescHeader & {
	readPorts: number
	writePorts: number
}

// Provides queueing and stalling for cache operations
export type CacheControllerDesc = CacheDescHeader & {
	readPorts: number
	writePorts: boolean[]
}

export type CoreDesc = {
	decoders: DecoderDesc[]
	units: OperationDescBody[]
	argInfo: ArgInfoMap
}
