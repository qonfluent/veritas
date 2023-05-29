import { TimeInstant } from '../Utility'
import { Identity } from './protocols/IdentityProtocol'
import { Ref, Location } from './Ref'

// A mapping of device IDs to addresses
export interface IAddressBook {
	get firewall(): IAddressBookFirewall

	// Add bindings to the pending set
	addBinding(device: Ref<Identity>, address: Ref<Location>): Promise<void>

	// Confirm a binding after adding it
	confirmBinding(device: Ref<Identity>, address: Ref<Location>): Promise<void>

	// Remove bindings
	removeBinding(device: Ref<Identity>, address: Ref<Location>): Promise<void>
	removeAllBindings(device: Ref<Identity>): Promise<void>

	// Get address from device
	getBindings(device: Ref<Identity>): Promise<AddressBinding[]>

	// Get devices from address
	getDevices(address: Ref<Location>): Promise<Ref<Identity>[]>

	destroy(): void
}

export interface IAddressBookFirewall {
	// Allow a binding to be added
	allowBind(device: Ref<Identity>, address: Ref<Location>): Promise<boolean>
}

export type AddressBinding = {
	address: Ref<Location>
	firstSeen: TimeInstant
	confirmation?: {
		firstConfirmed: TimeInstant
		lastConfirmed: TimeInstant
	}
}
