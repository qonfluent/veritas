import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type MultiplexingOptions = {
	initialStreams?: number
}

export interface IMultiplexingProtocol extends IProtocol<MultiplexingOptions, IMultiplexedConnection> {}

export interface IMultiplexedConnection extends IConnection {
	// Get all open streams
	get streams(): IConnection[]

	// Open a new stream
	openStream(): IConnection

	// Handle a stream being opened by a remote peer
	handleStreamOpen(callback: (stream: IConnection) => void): void
}
