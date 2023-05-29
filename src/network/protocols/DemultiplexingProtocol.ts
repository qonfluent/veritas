import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'
import { Ref } from '../Ref'

export type DemultiplexingOptions = {}

export interface IDemultiplexingProtocol extends IProtocol<DemultiplexingOptions, IDemultiplexedConnection> {}

export interface IDemultiplexedConnection extends IConnection {
	// Get all combined connections
	get streams(): IConnection[]

	// Add a new connection to the demultiplexed connection
	addStream(connection: IConnection): void

	// Remove a connection from the demultiplexed connection
	removeStream(connection: Ref<IConnection>): void
}
