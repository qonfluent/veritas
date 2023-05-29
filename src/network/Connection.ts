import { Ref, Location } from '../Utility'
import { ITransport } from './Transport'

export interface IConnection {
	// The name of the connection
	get id(): Ref<IConnection>

	// The connection this connection was upgraded from
	get parent(): Ref<IConnection> | undefined

	// The transport this connection is using
	get transport(): Ref<ITransport>

	// The local address of the connection
	get localAddress(): Ref<Location>

	// The remote address of the connection
	get remoteAddress(): Ref<Location>

	// Whether the connection was locally initiated
	get initiator(): boolean

	// Send a message to the remote peer
	send(msg: Uint8Array): void

	// Handle messages
	onMessage(handler: (msg: Uint8Array) => void): void

	// Handle connection close
	onClose(handler: () => void): void

	// Close the connection
	close(): void
}

export interface IListener {
	// The name of the listener
	get id(): Ref<IListener>

	// The listener this listener was upgraded from
	get parent(): Ref<IListener> | undefined

	// All open connections for this listener
	get connections(): IConnection[]

	// Handle new connections
	onConnection(handler: (connection: IConnection) => void): void

	// Handle listener close
	onClose(handler: () => void): void

	close(): void
}

export interface ITransportListener extends IListener {
	// The transport this listener is using
	get transport(): Ref<ITransport>

	// The local address of the listener
	get localAddress(): Ref<Location>
}
