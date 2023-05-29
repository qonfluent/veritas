import { Ref, Location } from './Ref'
import { IConnection, IListener } from './Connection'

export type DialOptions = {
	timeoutMS?: number
}

export type ListenOptions = {
	localAddress?: Ref<Location>
}

export interface ITransport {
	// The local addresses of the transport
	get localAddresses(): Ref<Location>[]

	// The firewall for the transport
	get firewall(): IAddressFirewall

	// The set of listeners for the transport
	get listeners(): IListener[]

	// The set of connections for the transport
	get connections(): IConnection[]

	// The maximum message size for the transport
	get maxMessageSize(): number

	// Dial a remote address
	dial(address: Ref<Location>, options?: DialOptions): Promise<IConnection>

	// Listen for inbound connections
	listen(options?: ListenOptions): IListener

	// Close all connections to a remote address
	closeConnections(address: Ref<Location>): void

	// Handle new connections
	onConnection(handler: (connection: IConnection) => void): void

	// Handle inbound connection denials
	onInboundDenied(handler: (address: Ref<Location>) => void): void

	// Handle outbound connection denials
	onOutboundDenied(handler: (address: Ref<Location>) => void): void

	// Close all listeners and connections
	closeAll(): void
}

export interface IAddressFirewall {
	// Allow or deny a connection
	allowConnection(connection: IConnection): Promise<boolean>

	// Allow or deny a dial
	allowDial(address: Ref<Location>): Promise<boolean>
}

export interface ITransportManager {
	// The local addresses of the instance
	get localAddresses(): Ref<Location>[]

	// The transports managed by the instance
	get transports(): ITransport[]

	// The listeners managed by the instance
	get listeners(): IListener[]

	// The connections managed by the instance
	get connections(): IConnection[]

	// Add a transport
	addTransport(transport: ITransport): void

	// Remove a transport
	removeTransport(transport: Ref<ITransport>): void

	// Get a transport
	getTransport(transport: Ref<ITransport>): ITransport | undefined

	// Select a transport for a remote address
	select(address: Ref<Location>): ITransport[]

	// Dial a remote address, adding a demultiplexer if necessary
	dial(address: Ref<Location>, options?: DialOptions): Promise<IConnection>

	// Listen for inbound connections
	listen(options?: ListenOptions): IListener

	// Close all connections to a remote address
	closeConnections(address: Ref<Location>): void

	// Handle new connections
	onConnection(handler: (connection: IConnection) => void): void
	
	// Close all listeners and connections
	closeAll(): void
}
