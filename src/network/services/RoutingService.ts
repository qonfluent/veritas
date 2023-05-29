import { IConnection, IListener } from '../Connection'
import { Identity } from './IdentityService'
import { Ref } from '../Ref'
import { IDiscoveryService } from './DiscoveryService'
import { DialOptions, ListenOptions } from '../Transport'

export interface IRoutingService extends IDiscoveryService {
	dial(address: Ref<Identity>, opts?: DialOptions): Promise<IConnection>
	listen(opts?: ListenOptions): Promise<IRouterListener>
}

export interface IRouterListener extends IListener {
	// The router this listener is associated with
	get router(): Ref<IRoutingService>

	// The local identity of the listener
	get localIdentity(): Ref<Identity>
}
