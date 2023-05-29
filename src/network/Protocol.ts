import { IConnection } from './Connection'
import { Ref } from './Ref'

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
	// Add a protocol
	addProtocol(protocol: AnyProtocol): void

	// Remove a protocol
	removeProtocol(protocol: Ref<AnyProtocol>): void

	// Get a protocol
	getProtocol(protocol: Ref<AnyProtocol>): Promise<AnyProtocol>

	// Given a set of protocols, select the preferred set
	select(protocols: Ref<AnyProtocol>[]): Promise<Ref<AnyProtocol>[]>
}

// Standard protocol stack
// 1.1. The transport protocol is responsible for ensuring a message either arrives in its entirety as sent, or not at all
// 1.2. The protocol exchange protocol is responsible for negotiating the protocol stack and drops out after the handshake
// 2.1. The reliability protocol is responsible for detecting, correcting, and updating higher level protocols of lost messages
// 2.2. The fragmentation protocol is responsible for splitting messages into smaller chunks
// 2.3. The encryption protocol is responsible for encrypting and decrypting messages with an ephemeral keypair
// 2.4. The compression protocol is responsible for compressing and decompressing messages
// 2.5. The identity protocol is responsible for authenticating the remote peer and drops out after the handshake
// 3.1. The multiplexing protocol is responsible for multiplexing multiple virtual connections over a single underlying connection
// 3.2. The peer discovery protocol is responsible for discovering peers
// 3.3. The peer routing protocol is responsible for routing messages to peers
// 3.4. The peer synchronization protocol is responsible for synchronizing peers clocks
