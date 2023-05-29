import { IConnection, IListener } from './Connection'
import { Ref, Location } from './Ref'
import { DialOptions, ITransport, ListenOptions } from './Transport'

export interface TransportManagerEvents {
	connection(source: ITransportManager, connection: IConnection): void
	inboundDenied(source: ITransportManager, address: Ref<Location>): void
	outboundDenied(source: ITransportManager, address: Ref<Location>): void
}

export interface ITransportManager {
	get localAddresses(): Ref<Location>[]
	get transports(): ITransport[]

	get listeners(): IListener[]
	get connections(): IConnection[]

	addTransport(transport: ITransport): void
	removeTransport(transport: Ref<ITransport>): void
	select(address: Ref<Location>): ITransport[]

	dial(address: Ref<Location>, options?: DialOptions): Promise<IConnection>
	listen(options?: ListenOptions): IListener

	closeConnections(address: Ref<Location>): void

	closeAll(): void
}
