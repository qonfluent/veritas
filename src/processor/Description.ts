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
export type CacheDesc = {
	addressBits: number
	widthBytes: number
	rows: number
	readPorts: number
	writePorts: number
	ways: number
}

// Caches form a hierarchy
export type CacheHierarchyDesc<T> = {
	cache: CacheDesc
	target: T
} | {
	cache: CacheDesc
	children: CacheHierarchyDesc<T>[]
}

export type RegisterFileDesc = {
	widthBytes: number
	rows: number
}

// A core has a fixed set of decoders with a shared set of arg sizes(number of registers, etc)
// The decoders have a set of groups/lanes which connect to various functional units
// Each unit is described in the description
// The cache hierarchy for the core is matched against the unit descriptions to ensure each unit has the required ports
export type CoreDesc = {
	argSizes: ArgInfoMap
	decoders: DecoderDesc[]
	units: OperationDesc[]
	cache: CacheHierarchyDesc<{
		decoders: DecoderIndex[]
		units: UnitIndex[]
	}>
}

// Devices are memory mapped IO drivers, providing things like RAM access
// They have access to an optional set of caches
export type DeviceDesc = {
	caches?: {
		widthBytes: number
	}[]
}

// A processor has a set of cores, devices, and a top level cache hierarchy
export type ProcessorDesc = {
	cores: CoreDesc[]
	devices: DeviceDesc[]
	cacheL3: CacheHierarchyDesc<{
		cores: CoreIndex[]
		devices: DeviceIndex[]
	}>
}
