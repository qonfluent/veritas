import { IAddressBook } from '../AddressBook'
import { IService } from '../Service'

export interface IDiscoveryService extends IService {
	// Address book the service updates
	get addressBook(): IAddressBook
}
