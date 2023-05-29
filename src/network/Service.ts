import { IConnection } from './Connection'
import { Ref } from '../Utility'

export interface IService {
	// The name of the service
	get id(): Ref<IService>

	// The list of connections
	get connections(): IConnection[]

	// Add a connection to the service
	addConnection(connection: IConnection): void

	// Remove a connection from the service
	removeConnection(connection: Ref<IConnection>): void

	// Close all connections
	closeAll(): void
}

export interface ServiceManager {
	// The list of services
	get services(): IService[]

	// Add a service
	addService(service: IService): void

	// Remove a service
	removeService(service: Ref<IService>): void

	// Get a service
	getService(service: Ref<IService>): IService | undefined

	// Close all services
	closeAll(): void
}