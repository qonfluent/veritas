import { Ref, Location } from './Ref'
import { ITransport } from './Transport'

export interface IConnection {
	// The connection this connection was upgraded from
	get parent(): Ref<IConnection> | undefined

	// The transport this connection is using
	get transport(): Ref<ITransport>

	// The local address of the connection
	get localAddress(): Ref<Location>

	// The remote address of the connection
	get remoteAddress(): Ref<Location>

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
	// The listener this listener was upgraded from
	get parent(): Ref<IListener> | undefined

	// The transport this listener is using
	get transport(): Ref<ITransport>

	// The local address of the listener
	get localAddress(): Ref<Location>

	// All open connections for this listener
	get connections(): IConnection[]

	// Handle new connections
	onConnection(handler: (connection: IConnection) => void): void

	// Handle listener close
	onClose(handler: () => void): void

	close(): void
}