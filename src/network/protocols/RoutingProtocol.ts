import { Ref } from '../Ref'
import { DiscoveryOptions, IDiscoveryConnection, IDiscoveryProtocol } from './DiscoveryProtocol'
import { Identity } from './IdentityProtocol'

export type RoutingOptions = DiscoveryOptions & {
	closestPeers(target: Ref<Identity>): Ref<Identity>[]
}

export interface IRoutingProtocol extends IDiscoveryProtocol {}

export interface IRoutingConnection extends IDiscoveryConnection {}
