import { Module } from "../hdl/HDL"

export type FieldName = string
export type UnitName = string
export type OperationId = string
export type RegisterFileName = string
export type CacheName = string

export type DecoderFieldDescHeader = {
	name: FieldName
}

export type DecoderFieldDescImmediate = DecoderFieldDescHeader & {
	type: 'immediate'
	dir: 'input'
	width: number
}

export type DecoderFieldDescRegister = DecoderFieldDescHeader & {
	type: 'register'
	dir: 'input' | 'output' | 'inout'
	file: RegisterFileName
	staticIndex?: number
}

export type DecoderFieldDescJoin = DecoderFieldDescHeader & {
	type: 'join'
	dir: 'input'
	widths: number[]
}

export type DecoderFieldDescDecode = DecoderFieldDescHeader & {
	type: 'decode'
	ops: {
		unit: UnitName
		args: (DecoderFieldDescImmediate | DecoderFieldDescRegister)[]
		extraFields: FieldName[]
	}[]
}

export type DecoderFieldDesc = DecoderFieldDescImmediate | DecoderFieldDescRegister | DecoderFieldDescJoin | DecoderFieldDescDecode

export type DecoderGroupDesc = {
	fields: DecoderFieldDesc[]
	minFields?: number
	extraBits?: number
}

export type DecoderDesc = {
	groups: DecoderGroupDesc[]
}

export type RegisterFileDesc = {
	widthBytes: number
	count: number
	rotary?: boolean
} | {
	widthsBytes: number[]
}

export type CacheDesc = {
	name: CacheName

	shiftBits: number
	selectorBits: number
	bankBits: number[]
	upperBits: number

	ways: number
}

export type CacheHierarchyDesc = {
	cache: CacheDesc
} | {
	caches: CacheHierarchyDesc[]
}

export type UnitDesc = {
	opId: OperationId
	module: Module
	crossfeeds: Record<UnitName, Record<FieldName, number>>
	latency: number
}

export type CoreDesc = {
	decoders: Record<UnitName, DecoderDesc>
	caches: CacheHierarchyDesc
	registerFiles: Record<RegisterFileName, RegisterFileDesc>
	units: Record<UnitName, UnitDesc>
}
