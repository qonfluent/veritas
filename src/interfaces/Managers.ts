import { IComputeProvider } from "./Compute"
import { Address, DialOptions, INetworkConnection, INetworkListener, INetworkProvider, ListenOptions } from "./Network"
import { IStorageProvider } from "./Storage"

export interface IManager<T> {
	get(id: Address): Promise<T | undefined>
	add(id: Address, provider: T): Promise<void>
	remove(id: Address): Promise<void>
	clear(): Promise<void>
	entries(): Promise<Map<Address, T>>
}

export interface IComputeManager extends IManager<IComputeProvider> {}

export interface IStorageManager extends IManager<IStorageProvider> {}

export interface INetworkManager extends IManager<INetworkProvider> {
	getInterfaces(): Promise<Address[]>

	dial(address: Address, opt?: DialOptions): Promise<INetworkConnection>
	listen(opt?: ListenOptions): Promise<INetworkListener>

	blocked(address: Address): Promise<boolean>
}
