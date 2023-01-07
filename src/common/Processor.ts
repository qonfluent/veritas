import { Module } from '../hdl/Module'

// Common types
export type Description = string
export type OperationIndex = number
export type OpcodeName = string
export type ArgName = string
export type RegisterFileName = string
export type CacheName = string
export type ModuleName = string

export type MetaData = {
	description?: Description
}

// Immediate arguments skip the register file
export type ArgDescImmedite = MetaData & { immediateBits: number }

// Register arguments are read from the register file
export type ArgDescRegister = MetaData & { registerFile: RegisterFileName }

// Cache arguments are read from the cache or written to the cache per direction
export type ArgDescCache = MetaData & { cache: CacheName, direction: 'read' | 'write' | 'readwrite' }

export type ArgDesc = ArgDescImmedite | ArgDescRegister | ArgDescCache

// An operation unit represents a single operation in the core
// It may include an internal decoder to select between multiple operations
// For instance +, -, &, |, ~, etc can all be a single operation unit with an
// immediate argument to select the sub-operation
export type OperationDesc = MetaData & {
	opcode: OpcodeName
	args: Record<ArgName, ArgDesc>
}

export type OperationUnitDesc = OperationDesc & {
	module: ModuleName
}

// A decoder has a set of groups. Group 0 is decoded on the first cycle, group 1 and 2 are decoded on the second cycle, etc
// Within each group there is a set of lanes, which are decoded in parallel
// Within each lane, there are a se of operations, which are selected between by the decoder
// Each operation index is looked up in the core's operation list to get the argument bits
export type ShortDecoderDesc = MetaData & {
	groups: OperationIndex[][][]
}

export type WideDecoderGroup = {
	split: {
		type: 'immediate' | 'register'
		width: number
	}[]
} | {
	join: number[]
	invertable: boolean
}

export type WideDecoderDesc = MetaData & {
	lanes: OperationIndex[][]
	groups: WideDecoderGroup[]
}

// A decoder group is a single decoder with a cache and instruction stream buffer
export type DecoderGroupDesc = MetaData & {
	decoder: ShortDecoderDesc | WideDecoderDesc
	cache: CacheName
}

// A register file is a set of registers
export type RegisterFileDesc = MetaData & {
	prefix: string
	count: number
	widthBits: number
}

// A cache has a set of banks(2 ** sum(bankBits)), each bank has a set of ways(ways)
// Each way is a set of lines(2 ** selectorBits), each line is 2 ** shiftBits bytes long
export type CacheDesc = MetaData & {
	// Address is split into:
	shiftBits: number
	selectorBits: number
	bankBits: number[]
	upperBits: number

	// Cache is split into:
	ways: number

	// Cache is accessed by:
	readPorts: number
	writePorts: {
		tristate: boolean
		rangeInvalidate: boolean
	}[]
}

// A cache controller wraps a cache with logic to handle cache misses and evictions
// On write, the cache controller will write to the cache and if eviction is signaled, it will write to the next level cache
// Writes contain a valid byte mask. Only lines which are at least partially valid are evicted.
// On read, the cache controller will read from the cache. On miss, it uses a retire station to hold the data until the next level cache returns it
// Read ports can either read from an address as usual, or request a given retire station be put on the bus instead
// Cache controllers are named so they can be referenced by the operational units
export type CacheControllerDesc = MetaData & {
	name: CacheName
	cache: CacheDesc
} & ({
	instructionCache: true
} | {
	retireStations: number
})

// A cache hierarchy constructs a coherrent cache hierarchy from a set of cache controllers
export type CacheHierarchyDesc = MetaData & {
	cache: CacheControllerDesc
} | {
	caches: CacheHierarchyDesc[]
}

// A core is a set of operation units, decoders, register files, and a cache hierarchy
// The general flow is:
// 0. Instruction pointers are loaded into the instruction caches within each decoder group
// 1. The instruction cache is read
// 2. The instruction cache way is selected
// 3. The data line is shifted into the decoder group's instruction stream buffer
// 4. The decoder decodes the instruction from the instruction stream buffer
// 5. The operation is executed
// 5.1. If needed, the register file is read(based on the arg types in the operation desc)
// 5.2. The operation is executed(adds a fixed latency)
// 5.3. If needed, the register file is written(based on the arg types in the operation desc)
export type CoreDesc = MetaData & {
	decoders: ShortDecoderDesc[]
	ops: OperationUnitDesc[]
	regFiles: Record<RegisterFileName, RegisterFileDesc>
	operationModules: Record<ModuleName, Module>

	caches: CacheHierarchyDesc
}

// Devices interact with the system via their cache messages
// They may also have a set of trigger ports which are used to trigger events internally
export type DeviceDesc = MetaData & {
	caches: {
		cache: CacheName
		direction: 'read' | 'write' | 'readwrite'
	}[]

	triggers: MetaData & {
		name: string
		triggerStart: number
		triggerEnd: number
	}[]
}

// The memory conroller is responsible for physical/virtual translation via a TLB and page table
// and for connecting to the memory itself to provide access
export type MemoryControllerDesc = MetaData & {
	channelCount: number
}

// A processor is a set of cores, devices, and a cache hierarchy
export type ProcessorDesc = MetaData & {
	cores: {
		core: CoreDesc
		cache: CacheName
	}[]

	devices: DeviceDesc[]
	caches: CacheHierarchyDesc
	memControllers: MemoryControllerDesc[]
}

// Description of the actual memory connected to the processor
export type MemoryDesc = MetaData & {
	bitsPerColumn: number
	columnsPerRow: number
	rowsPerBank: number
	banksPerGroup: number
	groupsPerChannel: number
	channels: number
}

export type ChannelDesc = MetaData & {}

export type SystemDeviceDesc = MetaData & ({
	processor: ProcessorDesc
} | {
	memory: MemoryDesc
} | {
	channel: ChannelDesc
})

// A system is a tree of devices
export type SystemDesc = MetaData & {
	devices: SystemDeviceDesc[]
} | {
	systems: SystemDesc[]
}

// A network is tree of systems
export type NetworkDesc = MetaData & {
	systems: SystemDesc[]
} | {
	networks: NetworkDesc[]
}
