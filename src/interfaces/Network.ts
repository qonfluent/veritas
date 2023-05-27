import { TypedEmitter } from 'tiny-typed-emitter'
import { Duplex } from './Stream'
import { Duration } from './Time'

export type Address = string

export type DialOptions = {
	timeout?: Duration
}

export type ListenOptions = {
	interface?: Address
}

export interface INetworkConnection extends Duplex<Uint8Array> {
	get initiator(): boolean
	kill(): Promise<void>
}

export interface INetworkListenerEvents {
	'connection': (connection: INetworkConnection) => void
	'error': (error: Error) => void
	'close': () => void
}

export interface INetworkListener extends TypedEmitter<INetworkListenerEvents> {
	kill(): Promise<void>
}

export interface INetworkProvider {
	dial(address: Address, opt?: DialOptions): Promise<INetworkConnection>
	listen(opt?: ListenOptions): Promise<INetworkListener>
}
