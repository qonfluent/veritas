import { IConnection } from './Connection'
import { Ref } from '../Utility'

export type AnyProtocol = IProtocol<any, any>

export interface IProtocol<Options, After extends IConnection> {
	// The id of the protocol
	get id(): Ref<AnyProtocol>

	// The upgrade function for the protocol
	upgrade(connection: IConnection, opts: Options): Promise<After>

	// The downgrade function for the protocol
	downgrade(connection: After): Promise<IConnection>
}

export interface IProtocolManager {
	// The list of protocols
	get protocols(): AnyProtocol[]

	// Add a protocol
	addProtocol(protocol: AnyProtocol): void

	// Remove a protocol
	removeProtocol(protocol: Ref<AnyProtocol>): void

	// Get a protocol
	getProtocol(protocol: Ref<AnyProtocol>): Promise<AnyProtocol>

	// Given a set of protocols, select the preferred set
	select(protocols: Ref<AnyProtocol>[]): Promise<Ref<AnyProtocol>[]>
}
