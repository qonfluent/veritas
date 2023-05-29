import { IConnection, IListener } from '../Connection'
import { Identity } from './IdentityService'
import { Ref } from '../../Utility'
import { IDiscoveryService } from './DiscoveryService'
import { DialOptions, ListenOptions } from '../Transport'
import { IAddressBook } from '../AddressBook'

export type ForwardRequestMessage = {
	target: Ref<Identity>
	message: Uint8Array
}

export interface IRoutingService extends IDiscoveryService {
	get firewall(): Ref<IRoutingFirewall>
	get addressBook(): IAddressBook

	dial(target: Ref<Identity>, opts?: DialOptions): Promise<IConnection>
	listen(opts?: ListenOptions): Promise<IRouterListener>

	findClosest(target: Uint8Array, count?: number): Promise<Ref<Identity>[]>

	closeConnections(address: Ref<Identity>): void

	onConnection(handler: (connection: IConnection) => void): void
	
	closeAll(): void
}

export interface IRouterListener extends IListener {
	// The router this listener is associated with
	get router(): Ref<IRoutingService>

	// The local identity of the listener
	get localIdentity(): Ref<Identity>
}

export interface IRoutingFirewall {
	// Allow or deny a connection
	allowConnection(connection: IConnection): Promise<boolean>

	// Allow or deny a dial
	allowDial(target: Ref<Identity>): Promise<boolean>

	// Allow or deny a forward
	allowForward(target: Ref<Identity>): Promise<boolean>
}
