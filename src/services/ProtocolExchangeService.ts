import { AnyProtocol, IProtocolManager } from '../network/Protocol'
import { Ref } from '../Utility'
import { IService } from '../Service'

export type ProtocolExchangeRequestMessage = {
	// The list of protocols we support
	protocols: Ref<AnyProtocol>[]
}

export type ProtocolExchangeResponseMessage = {
	// The list of protocols they support
	protocols: Ref<AnyProtocol>[]
}

export interface IProtocolExchangeService extends IService {
	// The protocol manager to use
	get protocolManager(): IProtocolManager
}
