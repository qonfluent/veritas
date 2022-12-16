import { ArgSizeMap, ArgType, DataType } from "./Types"

// Each unit in a core has a unique index
export type UnitIndex = number

// Each unit is described with an operation desc
export type OperationDesc = {
	argTypes: ArgType[]
	retTypes: DataType[]
}

// Units are combined into groups, where each group has a number of lanes
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

export type CacheDesc = {
	widthBytes: number
	rows: number
	ways: number
}

export type DecoderBlockDesc = {
	cache: CacheDesc
	decoder: DecoderDesc
}

export type CoreDesc = {
	argSizes: ArgSizeMap
	decoders: DecoderBlockDesc[]
	units: OperationDesc[]
	dataCachesL1: {
		cache: CacheDesc
		units: UnitIndex[]
	}[]
	cacheL2: CacheDesc
}

export type DeviceDesc = {}

export type ProcessorDesc = {
	cores: CoreDesc[]
	devices: DeviceDesc[]
	cacheL3: CacheDesc
}
