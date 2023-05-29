import { IConnection } from '../Connection'
import { Ref } from '../Ref'
import { AnyProtocol, IProtocol } from '../Protocol'

export type ProtocolExchangeOptions = {
	// The list of protocols to select from
	protocols: Ref<AnyProtocol>[]
}

export interface IProtocolExchangeProtocol extends IProtocol<ProtocolExchangeOptions, IProtocolExchangeConnection> {}

export interface IProtocolExchangeConnection extends IConnection {
	// The list of selected protocols, in the order they should be applied
	get selectedProtocols(): Ref<AnyProtocol>[]
}
