import { Ref, Location } from './Ref'
import { IConnection, IListener } from './Connection'

export type DialOptions = {
	timeoutMS?: number
}

export type ListenOptions = {
	localAddress?: Ref<Location>
}

export interface TransportEvents {
	// A new connection is established
	connection(source: ITransport, connection: IConnection): void

	// An inbound connection is denied
	inboundDenied(source: ITransport, address: Ref<Location>): void

	// An outbound connection is denied
	outboundDenied(source: ITransport, address: Ref<Location>): void
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

	// Dial a remote address
	dial(address: Ref<Location>, options?: DialOptions): Promise<IConnection>

	// Listen for inbound connections
	listen(options?: ListenOptions): IListener

	// Close all connections to a remote address
	closeConnections(address: Ref<Location>): void

	// Close all listeners and connections
	closeAll(): void
}

export interface IAddressFirewall {
	// Allow or deny a connection
	allowConnection(connection: IConnection): Promise<boolean>

	// Allow or deny a dial
	allowDial(address: Ref<Location>): Promise<boolean>
}
