import { GWModule, Signal, SignalT } from 'gateware-ts'
import { CacheModule, CacheReadPort, CacheWritePort } from './Cache'
import { CacheControllerDesc } from './Description'

export class CacheControllerModule extends GWModule {
	public readonly clk: SignalT = this.input(Signal())
	public readonly rst: SignalT = this.input(Signal())
	
	private readonly _cache: CacheModule
	private readonly _readPorts: CacheReadPort[]
	private readonly _writePorts: CacheWritePort[]

	public constructor(
		name: string,
		private readonly _desc: CacheControllerDesc,
	) {
		super(name)

		this._cache = new CacheModule(`cache`, {
			addressBits: _desc.addressBits,
			widthBytes: _desc.widthBytes,
			rows: _desc.rows,
			ways: _desc.ways,
			readPorts: _desc.readPorts,
			writePorts: _desc.writePorts.length,
		})

		const dataWidth = 8 * _desc.widthBytes
		
		this._readPorts = [...Array(_desc.readPorts)].map((_, i) => {
			return {
				read: this.createInternal(`internal_read_${i}`, Signal()),
				address: this.createInternal(`internal_read_${i}_address`, Signal(_desc.addressBits)),

				complete: this.createInternal(`internal_read_${i}_complete`, Signal()),
				hit: this.createInternal(`internal_read_${i}_hit`, Signal()),
				data: this.createInternal(`internal_read_${i}_data`, Signal(dataWidth)),
			}
		})

		this._writePorts = [...Array(_desc.writePorts)].map((_, i) => {
			return {
				write: this.createInternal(`internal_write_${i}`, Signal()),
				dirty: this.createInternal(`internal_write_${i}_dirty`, Signal()),
				address: this.createInternal(`internal_write_${i}_address`, Signal(_desc.addressBits)),
				data: this.createInternal(`internal_write_${i}_data`, Signal(dataWidth)),

				complete: this.createInternal(`internal_write_${i}_complete`, Signal()),
				evict: this.createInternal(`internal_write_${i}_evict`, Signal()),
				evictAddress: this.createInternal(`internal_write_${i}_evict_address`, Signal(_desc.addressBits)),
				evictData: this.createInternal(`internal_write_${i}_evict_data`, Signal(dataWidth)),
			}
		})
	}

	public describe(): void {
		this.addSubmodule(this._cache, `cache`, {
			inputs: {
				clk: this.clk,
				rst: this.rst,

				...Object.fromEntries(this._readPorts.flatMap(({ read, address }, i) => [
					[`read_${i}`, read],
					[`read_address_${i}`, address],
				])),
				...Object.fromEntries(this._writePorts.flatMap(({ write, dirty, address, data }, i) => [
					[`write_${i}`, write],
					[`write_dirty_${i}`, dirty],
					[`write_address_${i}`, address],
					[`write_data_${i}`, data],
				])),
			},
			outputs: {
				...Object.fromEntries(this._readPorts.flatMap(({ complete, hit, data}, i) => [
					[`read_complete_${i}`, [complete]],
					[`read_hit_${i}`, [hit]],
					[`read_data_${i}`, [data]],
				])),
				...Object.fromEntries(this._writePorts.flatMap(({ complete, evict, evictAddress, evictData }, i) => [
					[`write_complete_${i}`, [complete]],
					[`write_evict_${i}`, [evict]],
					[`write_evict_address_${i}`, [evictAddress]],
					[`write_evict_data_${i}`, [evictData]],
				])),
			},
		})
	}
}
