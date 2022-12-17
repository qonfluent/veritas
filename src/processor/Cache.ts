import { BlockStatement, Case, Concat, Constant, Edge, GWModule, HIGH, If, LogicalNot, Signal, SignalArray, SignalArrayT, SignalT, Switch, Ternary } from 'gateware-ts'
import { CacheDesc } from './Description'
import { andAll, clearRegs, findFirstSet, indexArray, muxAll, orAll } from './Utils'

export class CacheModule extends GWModule {
	public clk: SignalT = this.input(Signal())
	public rst: SignalT = this.input(Signal())

	public readPorts: {
		// Inputs
		read: SignalT
		address: SignalT

		// Outputs
		complete: SignalT
		hit: SignalT
		data: SignalT
	}[]

	public writePorts: {
		// Inputs
		write: SignalT
		dirty: SignalT
		address: SignalT
		data: SignalT

		// Outputs
		complete: SignalT
		evict: SignalT
		evictAddress: SignalT // NOTE: should be an in_out with the normal address lines
		evictData: SignalT // NOTE: should be an in_out with the normal data lines
	}[]

	private _ways: {
		valids: SignalT
		dirtys: SignalT
		tags: SignalArrayT
		data: SignalArrayT
	}[]

	private _readPorts: {
		inProgress: SignalT
		compareTag: SignalT
		ways: {
			loadedValid: SignalT
			loadedTag: SignalT
			loadedData: SignalT
			match: SignalT
		}[]
	}[]

	private _writePorts: {
		// Cycle 1 registers
		inProgress: SignalT
		dirty: SignalT
		compareTag: SignalT
		selector: SignalT
		writeData: SignalT
		preSelectedWay: SignalT
		
		// Cycle 2 wires
		anyMatch: SignalT
		allValid: SignalT
		selectedWay: SignalT

		evict: SignalT
		evictAddress: SignalT
		evictData: SignalT

		ways: {
			// Per-way registers
			loadedValid: SignalT
			loadedDirty: SignalT
			loadedTag: SignalT
			loadedData: SignalT

			// Per-way wires
			match: SignalT
		}[]
	}[]

	private _selectorStartBit: number
	private _selectorEndBit: number

	public constructor(
		name: string,
		private readonly _desc: CacheDesc,
	) {
		super(name)

		const selectorWidth = Math.ceil(Math.log2(_desc.rows))
		this._selectorStartBit = Math.ceil(Math.log2(_desc.widthBytes))
		this._selectorEndBit = this._selectorStartBit + selectorWidth - 1
		const tagWidth = _desc.addressBits - selectorWidth - this._selectorStartBit
		const dataWidth = 8 * _desc.widthBytes

		this._ways = [...Array(_desc.ways)].map((_, i) => {
			return {
				valids: this.createInternal(`way_${i}_valids`, Signal(_desc.rows)),
				dirtys: this.createInternal(`way_${i}_dirtys`, Signal(_desc.rows)),
				tags: this.createInternal(`way_${i}_tags`, SignalArray(tagWidth, _desc.rows)),
				data: this.createInternal(`way_${i}_data`, SignalArray(dataWidth, _desc.rows)),
			}
		})

		this._readPorts = [...Array(_desc.readPorts)].map((_, i) => {
			return {
				inProgress: this.createInternal(`read_port_${i}_in_progress`, Signal()),
				compareTag: this.createInternal(`read_port_${i}_compare_tag`, Signal(tagWidth)),
				ways: [...Array(_desc.ways)].map((_, j) => {
					return {
						loadedValid: this.createInternal(`read_port_${i}_way_${j}_valid`, Signal()),
						loadedTag: this.createInternal(`read_port_${i}_way_${j}_tag`, Signal(tagWidth)),
						loadedData: this.createInternal(`read_port_${i}_way_${j}_loaded_data`, Signal(dataWidth)),
						match: this.createInternal(`read_port_${i}_way_${j}_match`, Signal()),
					}
				})
			}
		})

		const wayWidth = Math.ceil(Math.log2(_desc.ways))
		this._writePorts = [...Array(_desc.writePorts)].map((_, i) => {
			return {
				inProgress: this.createInternal(`write_port_${i}_in_progress`, Signal()),
				dirty: this.createInternal(`write_port_${i}_dirty`, Signal()),
				compareTag: this.createInternal(`write_port_${i}_compare_tag`, Signal(tagWidth)),
				selector: this.createInternal(`write_port_${i}_selector`, Signal(selectorWidth)),
				writeData: this.createInternal(`write_port_${i}_write_data`, Signal(dataWidth)),
				
				anyMatch: this.createInternal(`write_port_${i}_any_match`, Signal()),
				allValid: this.createInternal(`write_port_${i}_all_valid`, Signal()),
				preSelectedWay: this.createInternal(`write_port_${i}_pre_selected_way`, Signal(wayWidth)),
				selectedWay: this.createInternal(`write_port_${i}_selected_way`, Signal(wayWidth)),

				evict: this.createInternal(`write_port_${i}_evict`, Signal()),
				evictAddress: this.createInternal(`write_port_${i}_evict_address`, Signal(_desc.addressBits)),
				evictData: this.createInternal(`write_port_${i}_evict_data`, Signal(dataWidth)),

				ways: [...Array(_desc.ways)].map((_, j) => {
					return {
						loadedValid: this.createInternal(`write_port_${i}_way_${j}_valid`, Signal()),
						loadedDirty: this.createInternal(`write_port_${i}_way_${j}_dirty`, Signal()),
						loadedTag: this.createInternal(`write_port_${i}_way_${j}_tag`, Signal(tagWidth)),
						loadedData: this.createInternal(`write_port_${i}_way_${j}_loaded_data`, Signal(dataWidth)),
						match: this.createInternal(`write_port_${i}_way_${j}_match`, Signal()),
					}
				})
			}
		})

		this.readPorts = [...Array(_desc.readPorts)].map((_, i) => {
			return {
				read: this.createInput(`read_${i}`, Signal()),
				address: this.createInput(`read_address_${i}`, Signal(_desc.addressBits)),

				complete: this.createOutput(`read_complete_${i}`, Signal()),
				hit: this.createOutput(`read_hit_${i}`, Signal()),
				data: this.createOutput(`read_data_${i}`, Signal(dataWidth)),
			}
		})

		this.writePorts = [...Array(_desc.readPorts)].map((_, i) => {
			return {
				write: this.createInput(`write_${i}`, Signal()),
				dirty: this.createInput(`write_dirty_${i}`, Signal()),
				address: this.createInput(`write_address_${i}`, Signal(_desc.addressBits)),
				data: this.createInput(`write_data_${i}`, Signal(dataWidth)),
				
				complete: this.createOutput(`write_complete_${i}`, Signal()),
				evict: this.createOutput(`write_evict_${i}`, Signal()),
				evictAddress: this.createOutput(`write_evict_address_${i}`, Signal(_desc.addressBits)),
				evictData: this.createOutput(`write_evict_data_${i}`, Signal(dataWidth)),
			}
		})
	}

	public describe(): void {
		this.combinationalLogic([
			// Wire up read port match logic
			...this._readPorts.flatMap(({ ways, compareTag }) => {
				return ways.map(({ match, loadedValid, loadedTag }) => {
					return match ['='] (loadedValid ['&&'] (loadedTag ['=='] (compareTag)))
				})
			}),

			// Wire up write port match logic
			...this._writePorts.flatMap(({ ways, compareTag }) => {
				return ways.map(({ match, loadedValid, loadedTag }) => {
					return match ['='] (loadedValid ['&&'] (loadedTag ['=='] (compareTag)))
				})
			}),

			// Wire up internal write port logic
			...this._writePorts.flatMap(({ selector, selectedWay, preSelectedWay, ways, anyMatch, allValid, evict, evictAddress, evictData }) => {
				const matches = ways.map(({ match }) => match)
				const valids = ways.map(({ loadedValid, loadedDirty }) => loadedValid ['&&'] (loadedDirty))

				const lineWidth = Math.ceil(Math.log2(this._desc.widthBytes))

				return [
					anyMatch ['='] (orAll(matches)),
					allValid ['='] (andAll(valids)),
					selectedWay ['='] (Ternary(anyMatch, findFirstSet(matches), Ternary(allValid, preSelectedWay, findFirstSet(valids)))),

					evict ['='] (LogicalNot(anyMatch) ['&&'] (allValid)),
					evictAddress ['='] (indexArray(ways.map(({ loadedTag }) => Concat([loadedTag, selector, Constant(lineWidth, 0)])), preSelectedWay)),
					evictData ['='] (indexArray(ways.map(({ loadedData }) => loadedData), preSelectedWay)),
				]
			})
		])

		this.syncBlock(this.clk, Edge.Negative, [
			If(this.rst ['=='] (HIGH), [
				...clearRegs([
					...this.readPorts.flatMap(({ complete, hit, data }) => [complete, hit, data]),
					...this.writePorts.flatMap(({ complete, evict, evictAddress, evictData }) => [complete, evict, evictAddress, evictData]),
					...this._readPorts.flatMap(({ inProgress, compareTag, ways }) => [
						inProgress,
						compareTag,
						...ways.flatMap(({ loadedValid, loadedTag, loadedData }) => [loadedValid, loadedTag, loadedData]),
					]),
					...this._writePorts.flatMap(({ inProgress, dirty, compareTag, selector, writeData, preSelectedWay, ways }) => [
						inProgress,
						dirty,
						compareTag,
						selector,
						writeData,
						preSelectedWay,
						...ways.flatMap(({ loadedValid, loadedDirty, loadedTag, loadedData }) => [loadedValid, loadedDirty, loadedTag, loadedData]),
					]),
				])
			]).Else([
				// Update read port registers
				...this.readCycle1(),
				...this.readCycle2(),

				// Update write port registers
				...this.writeCycle1(),
				...this.writeCycle2(),
			])
		])
	}

	private readCycle1(): BlockStatement[] {
		// For each read port
		return this._readPorts.flatMap(({ inProgress, compareTag, ways }, portIndex) => {
			// Load the IO port and get the address selector
			const port = this.readPorts[portIndex]
			const selector = port.address.slice(this._selectorStartBit, this._selectorEndBit)

			return [
				inProgress ['='] (port.read),
				compareTag ['='] (port.address.slice(this._selectorEndBit + 1, port.address.width - 1)),
				...ways.flatMap(({ loadedValid, loadedTag, loadedData }, wayIndex) => {
					// Read the selected data in each way to the read port/way's compare buffer
					return [
						loadedValid ['='] ((this._ways[wayIndex].valids ['>>'] (selector)) ['&'] (Constant(1, 1))),
						loadedTag ['='] (this._ways[wayIndex].tags.at(selector)),
						loadedData ['='] (this._ways[wayIndex].data.at(selector)),
					]
				})
			]
		})
	}

	private readCycle2(): BlockStatement[] {
		// For each read port
		return this._readPorts.flatMap(({ inProgress, ways }, portIndex) => {
			const port = this.readPorts[portIndex]

			return [
				port.complete ['='] (inProgress),
				// Hit when any way hits
				port.hit ['='] (orAll(ways.map(({ match }) => match))),
				// Selected way is the first matching way
				port.data ['='] (muxAll(ways.map(({ match, loadedData }) => ({ data: loadedData, select: match })))),
			]
		})
	}

	private writeCycle1(): BlockStatement[] {
		// Foreach write port
		return this._writePorts.flatMap(({ inProgress, dirty, compareTag, selector, writeData, preSelectedWay, ways }, portIndex) => {
			// Load the IO port and get the address selector
			const port = this.writePorts[portIndex]
			const selectorValue = port.address.slice(this._selectorStartBit, this._selectorEndBit)

			return [
				// Update internal registers
				inProgress ['='] (port.write),
				dirty ['='] (port.dirty),
				compareTag ['='] (port.address.slice(this._selectorEndBit + 1, port.address.width - 1)),
				selector ['='] (selectorValue),
				writeData ['='] (port.data),
				// Store selected way so it's available for and evict
				preSelectedWay ['='] (port.address.slice(this._selectorEndBit + 1, this._selectorEndBit + preSelectedWay.width)),

				// Load from ways
				...ways.flatMap(({ loadedValid, loadedTag, loadedData }, wayIndex) => {
					return [
						loadedValid ['='] ((this._ways[wayIndex].valids ['>>'] (selectorValue)) ['&'] (Constant(1, 1))),
						loadedTag ['='] (this._ways[wayIndex].tags.at(selectorValue)),
						loadedData ['='] (this._ways[wayIndex].data.at(selectorValue)),
					]
				})
			]
		})
	}

	private writeCycle2(): BlockStatement[] {
		// Foreach write port
		return this._writePorts.flatMap(({ inProgress, compareTag, selector, selectedWay, writeData, dirty, evict, evictAddress, evictData }, portIndex) => {
			const port = this.writePorts[portIndex]

			return [
				// Update output ports
				port.complete ['='] (inProgress),
				port.evict ['='] (evict),
				port.evictAddress ['='] (evictAddress),
				port.evictData ['='] (evictData),

				// Update internal state
				If(inProgress, [
					Switch(selectedWay, this._ways.map(({ valids, dirtys, tags, data }, wayIndex) => {
						return Case(wayIndex, [
							valids ['='] (valids ['|'] (Constant(valids.width, 1) ['<<'] (selector))),
							dirtys ['='] (dirtys ['|'] (dirty ['<<'] (selector))),
							tags.at(selector) ['='] (compareTag),
							data.at(selector) ['='] (writeData),
						])
					}))
				]),
			]
		})
	}
}
