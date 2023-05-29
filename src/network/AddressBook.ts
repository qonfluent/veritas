import { TimeDuration, TimeInstant } from '../Utility'
import { Identity } from './services/IdentityService'
import { Ref, Location } from '../Utility'

// A mapping of identities to addresses
export interface IAddressBook {
	get firewall(): IAddressBookFirewall

	// Add bindings to the pending set
	addBinding(identity: Identity, address: Ref<Location>): Promise<void>

	// Confirm a binding after adding it
	confirmBinding(identity: Ref<Identity>, address: Ref<Location>): Promise<void>

	// Remove bindings
	removeBinding(identity: Ref<Identity>, address: Ref<Location>): Promise<void>

	// Remove all bindings for an identity
	removeIdentity(identity: Ref<Identity>): Promise<void>

	// Get address from identity
	getBindings(identity: Ref<Identity>): Promise<AddressBinding[]>

	// Get devices from address
	getIdentities(address: Ref<Location>): Promise<Ref<Identity>[]>

	// Get all active identities based on some liveness cutoff, sorted by last confirmed
	getActive(cutoff?: TimeDuration): Promise<Ref<Identity>[]>

	// Clear cache
	clear(before?: TimeInstant): Promise<void>
}

export interface IAddressBookFirewall {
	// Allow a binding to be added
	allowBind(identity: Ref<Identity>, address: Ref<Location>): Promise<boolean>
}

export type AddressBinding = {
	address: Ref<Location>
	firstSeen: TimeInstant
	confirmation?: {
		firstConfirmed: TimeInstant
		lastConfirmed: TimeInstant
	}
}
