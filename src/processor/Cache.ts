import { Edge, GWModule, HIGH, If, Signal, SignalArray, SignalArrayT, SignalT } from 'gateware-ts'
import { CacheDesc } from './Description'
import { muxAll, orAll } from './Utils'

export class CacheModule extends GWModule {
	public clk: SignalT = this.input(Signal())
	public rst: SignalT = this.input(Signal())

	public readPorts: {
		read: SignalT
		address: SignalT

		complete: SignalT
		hit: SignalT
		data: SignalT
	}[]

	public writePorts: {
		write: SignalT
		dirty: SignalT
		address: SignalT
		data: SignalT

		complete: SignalT
		evict: SignalT
		evictAddress: SignalT // NOTE: should be an in_out with the normal address lines
		evictData: SignalT // NOTE: should be an in_out with the normal data lines
	}[]

	private _ways: {
		valids: SignalArrayT
		dirtys: SignalArrayT
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
				valids: this.createInternal(`way_${i}_valids`, SignalArray(1, _desc.rows)),
				dirtys: this.createInternal(`way_${i}_dirtys`, SignalArray(1, _desc.rows)),
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
				address: this.createInput(`write_address_${i}`, Signal()),
				data: this.createInput(`write_data_${i}`, Signal()),
				
				complete: this.createOutput(`write_complete_${i}`, Signal()),
				evict: this.createOutput(`write_evict_${i}`, Signal()),
				evictAddress: this.createOutput(`write_evict_address_${i}`, Signal()),
				evictData: this.createOutput(`write_evict_data_${i}`, Signal()),
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
			})
		])

		this.syncBlock(this.clk, Edge.Negative, [
			If(this.rst ['=='] (HIGH), [

			]).Else([
				// Read cycle 1, load data
				...this._readPorts.flatMap(({ inProgress, compareTag, ways }, portIndex) => {
					const port = this.readPorts[portIndex]
					const selector = port.address.slice(this._selectorStartBit, this._selectorEndBit)

					return [
						inProgress ['='] (port.read),
						compareTag ['='] (port.address.slice(this._selectorEndBit + 1, port.address.width - 1)),
						...ways.flatMap(({ loadedValid, loadedTag, loadedData }, wayIndex) => {
							return [
								loadedValid ['='] (this._ways[wayIndex].valids.at(selector)),
								loadedTag ['='] (this._ways[wayIndex].tags.at(selector)),
								loadedData ['='] (this._ways[wayIndex].data.at(selector)),
							]
						})
					]
				}),

				// Read cycle 2, check ways, write outputs
				...this._readPorts.flatMap(({ inProgress, ways }, portIndex) => {
					const port = this.readPorts[portIndex]

					return [
						port.complete ['='] (inProgress),
						port.hit ['='] (orAll(ways.map(({ match }) => match))),
						port.data ['='] (muxAll(ways.map(({ match, loadedData }) => ({ data: loadedData, select: match })))),
					]
				}),

				// Write cycle 1, load data
				
				// Write cycle 2, write to selected way, write outputs
			])
		])
	}
}
