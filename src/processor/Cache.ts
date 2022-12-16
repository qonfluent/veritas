import { Edge, GWModule, HIGH, If, Signal, SignalArray, SignalArrayT, SignalT } from 'gateware-ts'
import { CacheWayDesc } from './Description'

export type CacheReadPort = {
	read: SignalT
	address: SignalT

	complete: SignalT
	hit: SignalT
	data: SignalT
}

export type CacheWritePort = {
	write: SignalT
	address: SignalT
	data: SignalT

	complete: SignalT
	hit: SignalT
}

export class CacheWayModule extends GWModule {
	public clk: SignalT = this.input(Signal())
	public rst: SignalT = this.input(Signal())

	public stall: SignalT = this.input(Signal())

	public readPorts: CacheReadPort[]
	public writePorts: CacheWritePort[]

	private _tags: SignalArrayT
	private _data: SignalArrayT

	private _readPorts: {
		inProgress: SignalT
		tagBuffer: SignalT
		testTagBuffer: SignalT
		dataBuffer: SignalT
	}[]

	private _selectorStartBit: number
	private _selectorEndBit: number

	public constructor(
		name: string,
		private readonly _desc: CacheWayDesc,
	) {
		super(name)

		const tagWidth = Math.ceil(Math.log2(_desc.rows))
		this._tags = this.createInternal(`tag_ram`, SignalArray(tagWidth, _desc.rows))
		this._data = this.createInternal(`data_ram`, SignalArray(_desc.widthBytes * 8, _desc.rows))

		this._selectorStartBit = Math.ceil(Math.log2(_desc.widthBytes))
		this._selectorEndBit = this._selectorStartBit + tagWidth - 1

		this._readPorts = [...Array(_desc.readPorts)].map((_, i) => {
			return {
				inProgress: this.createInternal(`read_in_progress_${i}`, Signal()),
				tagBuffer: this.createInternal(`read_tag_buffer_${i}`, Signal()),
				testTagBuffer: this.createInternal(`read_test_tag_buffer_${i}`, Signal()),
				dataBuffer: this.createInternal(`read_data_buffer_${i}`, Signal()),
			}
		})

		this.readPorts = [...Array(_desc.readPorts)].map((_, i) => {
			return {
				read: this.createInput(`read_${i}`, Signal()),
				address: this.createInput(`read_address_${i}`, Signal()),

				complete: this.createOutput(`read_complete_${i}`, Signal()),
				hit: this.createOutput(`read_hit_${i}`, Signal()),
				data: this.createOutput(`read_data_${i}`, Signal()),
			}
		})

		this.writePorts = [...Array(_desc.writePorts)].map((_, i) => {
			return {
				write: this.createInput(`write_${i}`, Signal()),
				address: this.createInput(`write_address_${i}`, Signal()),
				data: this.createInput(`write_data_${i}`, Signal()),

				complete: this.createOutput(`write_complete_${i}`, Signal()),
				hit: this.createOutput(`write_hit_${i}`, Signal()),
			}
		})
	}

	public describe(): void {
		this.combinationalLogic([
			// Connect up async read data
			...this.readPorts.flatMap(({ complete, hit, data }, i) => {
				const readPort = this._readPorts[i]

				return [
					complete ['='] (readPort.inProgress),
					hit ['='] (readPort.tagBuffer ['=='] (readPort.testTagBuffer)),
					data ['='] (readPort.dataBuffer)
				]
			}),
		])

		this.syncBlock(this.clk, Edge.Negative, [
			If(this.rst ['=='] (HIGH), [

			]).Else([
				If(this.stall ['=='] (HIGH), [

				]).Else([
					// First cycle for reads, copy selected entry to buffer
					...this._readPorts.flatMap(({ inProgress, tagBuffer, testTagBuffer, dataBuffer }, i) => {
						const { read, address } = this.readPorts[i]
						const selector = address.slice(this._selectorStartBit, this._selectorEndBit)
						const tag = address.slice(this._selectorEndBit + 1, address.width - 1)

						return [
							inProgress ['='] (read),
							tagBuffer ['='] (this._tags.at(selector)),
							testTagBuffer ['='] (tag),
							dataBuffer ['='] (this._data.at(selector)),
						]
					}),

					// First cycle for writes, put selected data into tags/data
					...this.writePorts.flatMap(({ write, address, data, complete, hit }) => {
						const selector = address.slice(this._selectorStartBit, this._selectorEndBit)
						const tag = address.slice(this._selectorEndBit + 1, address.width - 1)

						return [
							complete ['='] (write),
							hit ['='] (this._tags.at(selector) ['=='] (tag)),
							If(write ['=='] (HIGH), [
								this._tags.at(selector) ['='] (tag),
								this._data.at(selector) ['='] (data),
							]),
						]
					})
				])
			])
		])
	}
}
