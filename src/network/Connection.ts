import { TypedEmitter } from 'tiny-typed-emitter'
import { Ref, Location } from './Ref'

export interface ConnectionEvents {
	// Data is received
	data(source: IConnection, msg: Uint8Array): void

	// Connection is closed
	close(source: IConnection): void
}

export interface IConnection extends TypedEmitter<ConnectionEvents> {
	// The connection this connection was upgraded from
	get parent(): Ref<IConnection> | undefined

	// The local address of the connection
	get localAddress(): Ref<Location>

	// The remote address of the connection
	get remoteAddress(): Ref<Location>

	// Send a message to the remote peer
	send(msg: Uint8Array): void

	// Close the connection
	close(): void
}

export interface ListenerEvents {
	connection(source: IListener, connection: IConnection): void
	close(source: IListener): void
}

export interface IListener extends TypedEmitter<ListenerEvents> {
	get localAddress(): Ref<Location>
	get connections(): IConnection[]

	close(): void
}
