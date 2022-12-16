import { ArgSizeMap, ArgType, DataType } from "./Types"

export type UnitIndex = number

export type OperationDesc = {
	argTypes: ArgType[]
	retTypes: DataType[]
}

export type DecoderGroupDesc = {
	lanes: {
		ops: UnitIndex[]
	}[]
}

export type DecoderDesc = {
	shiftBits: number
	argSizes: ArgSizeMap
	groups: DecoderGroupDesc[]
}
