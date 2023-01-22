import { Module, Signal } from "../hdl/HDL"

export type FieldName = string
export type UnitName = string
export type OperationId = string
export type DecoderName = string
export type RegisterFileName = string
export type CacheName = string

export type DecoderFieldDescHeader = {
	name: FieldName
}

// Immediate values are copied directly from the instruction
export type DecoderFieldDescImmediate = DecoderFieldDescHeader & {
	type: 'immediate'
	dir: 'input'
	width: number
	maxValue?: number	
}

// Register values are copied from the given register file. If staticIndex is
// set, that value is used as the register file index. Otherwise, the index
// is taken from the instruction. See register file description for more
export type DecoderFieldDescRegister = DecoderFieldDescHeader & {
	type: 'register'
	dir: 'input' | 'output' | 'inout'
	registerFile: RegisterFileName
	staticIndex?: number
}

// Batches read multiple fields as a single field. This is useful for
// including groups of fields that must be included together.
export type DecoderFieldDescBatch = DecoderFieldDescHeader & {
	type: 'batch'
	entries: (DecoderFieldDescImmediate | DecoderFieldDescRegister)[]
}

// Joins multiple segments of the instruction into a single field. This is
// useful for immediate values with a large dynamic range
export type DecoderFieldDescJoin = DecoderFieldDescHeader & {
	type: 'join'
	dir: 'input'
	widths: number[]
}

// Decodes the instruction into a unit and arguments. The unit refers to a
// unit from the unit table in the core. The arguments are either immediate
// values or register references. Needed fields can be copied from the decoder
// to the given unit as well.
export type DecoderFieldDescDecode = DecoderFieldDescHeader & {
	type: 'decode'
	ops: {
		unit: UnitName
		args: (DecoderFieldDescImmediate | DecoderFieldDescRegister)[]
		neededFields?: FieldName[]
	}[]
}

export type DecoderFieldDesc = DecoderFieldDescImmediate | DecoderFieldDescRegister | DecoderFieldDescJoin | DecoderFieldDescDecode

// A group has a variable number of fields from minFields to the number of
// fields in the list. Extra signals can be added to the group as well
export type DecoderGroupDesc = {
	fields: DecoderFieldDesc[]
	minFields?: number
	extraSignals?: Signal
}

// A decoder has some set of groups along with a set of extra signals. All signals
// are decoded in parallel, with a latency of 1 cycle for group zero and 1 additional
// cycle for each additional pair of groups.
// Certain bit patterns are invalid, these patterns are converted to an integer and
// sent to the invalid handler unit if it is defined
export type DecoderDesc = {
	name: DecoderName
	groups: DecoderGroupDesc[]
	extraSignals?: Signal
	invalidHandler?: UnitName
}

// Register files are either uniform or non-uniform. Uniform register files
// have a single width for all registers and may have a type. Non-uniform
// register files have a width for each register but can only have the index type
// Index - Uses index bits to read/write
// Stack/Queue - No index bits, reads/writes on ends of stack/queue
// Belt - Index bits on read, writes to end of belt
export type RegisterFileDesc = {
	name: RegisterFileName
	uniform: true
	type: 'index' | 'stack' | 'queue' | 'belt'
	widthBytes: number
	count: number
} | {
	name: RegisterFileName
	uniform: false
	type: 'index'
	widthsBytes: number[]
}

// Describes a single cache. Ports are implied by the rest of the structure
export type CacheDesc = {
	name: CacheName

	shiftBits: number
	selectorBits: number
	bankBits: number[]
	upperBits: number

	ways: number
}

// Describes a cache hierarchy. Caches can be nested and bussed together
export type CacheHierarchyDesc = {
	// Children are grouped by port and bussed on each port
	children?: CacheHierarchyDesc[][]
	cache: CacheDesc
}

// Instruction ports present a byte stream interface
export type CacheInstructionPortDesc = {
	type: 'instruction'
	streamBytes: number
}

// Data ports present a retire station async interface
export type CacheDataPortDesc = {
	type: 'data'
	retireStations: number
}

// Write ports can either be tristate or not
export type CacheWritePortDesc = {
	tristate: boolean
}

// Cache ports
export type CachePortDesc
	= { cache: CacheName, read: true, write: false } & (CacheInstructionPortDesc | CacheDataPortDesc)
	| { cache: CacheName, read: false, write: true } & CacheWritePortDesc
	| { cache: CacheName, read: true, write: true } & (CacheInstructionPortDesc | CacheDataPortDesc) & CacheWritePortDesc

// A functional unit has some operation ID(hash of unit's specification) used to uniquely identify it
// The module implements the operation and the latency is the number of cycles it takes to complete
// The cache ports are the ports that the unit uses to access the cache hierarchy if needed
// The connected decoder ports, cache ports, and crossfeed ports are all routed to the module
// as signals with specific names.
export type UnitDesc = {
	module: Module
	cachePorts?: CachePortDesc[]
	latency: number
}

// For tristate, busses the units together
// otherwise, creates an output for the first unit and inputs for the rest
export type CrossfeedDesc = {
	units: UnitName[]
	tristate?: boolean
}

export type CoreDesc = {
	decoders: DecoderDesc[]
	caches: CacheHierarchyDesc
	registerFiles: RegisterFileDesc[]
	units: UnitDesc[]
	crossfeeds: CrossfeedDesc[]
}
