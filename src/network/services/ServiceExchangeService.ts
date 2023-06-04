import { Ref } from '../../Utility'
import { IConnection } from '../Connection'
import { IService, IServiceManager } from '../Service'

export type ServiceExchangeRequestMessage = {
	// The list of services we support
	services: Ref<IService>[]
}

export type ServiceExchangeResponseMessage = {
	// The list of services they support
	services: Ref<IService>[]
}

export type ServiceMessage = {
	// Index of service in agreed service table
	serviceIndex: number

	// Data to send to service
	data: Uint8Array
}

export interface IServiceExchangeService extends IService {
	// The service manager to use
	get serviceManager(): IServiceManager

	// Get the list of supported sevices for a given connection
	getSupportedServices(connection: Ref<IConnection>): Ref<IService>[]
}
