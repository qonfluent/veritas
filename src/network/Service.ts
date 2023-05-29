import { IConnection } from './Connection'
import { Ref } from './Ref'

export interface IService {
	// The name of the service
	get id(): Ref<IService>

	// The list of connections
	get connections(): IConnection[]

	// Add a connection to the service
	addConnection(connection: IConnection): void

	// Remove a connection from the service
	removeConnection(connection: Ref<IConnection>): void
}
