import { KeyPair } from '../../crypto/Types'
import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type EncryptionOptions = {
	// The local keypair
	localKeyPair: KeyPair
}

export interface IEncryptionProtocol extends IProtocol<EncryptionOptions, IEncryptedConnection> {}

export interface IEncryptedConnection extends IConnection {
	get localKeyPair(): KeyPair
	get remotePublicKey(): Uint8Array
}
