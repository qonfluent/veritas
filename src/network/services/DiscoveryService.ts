import { IAddressBook } from '../AddressBook'
import { Ref } from '../Ref'
import { IService } from '../Service'
import { Identity } from './IdentityService'

export type DiscoveryPushMessage = {
	// The collection of identities we are pushing
	identities: Identity[]
}

export interface IDiscoveryService extends IService {
	// Get local identities
	get localIdentities(): Identity[]
	
	// Add a local identity
	addLocalIdentity(identity: Identity): void

	// Remove a local identity
	removeLocalIdentity(identity: Ref<Identity>): void

	// Address book the service updates
	get addressBook(): IAddressBook
}
