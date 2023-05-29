import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'
import { Identity } from './IdentityProtocol'
import { Ref } from '../Ref'
import { IAddressBook } from '../AddressBook'

export type DiscoveryOptions = {
	addressBook: IAddressBook
}

export interface IDiscoveryProtocol extends IProtocol<DiscoveryOptions, IDiscoveryConnection> {}

export interface IDiscoveryConnection extends IConnection {
	get peers(): Ref<Identity>[]
}
