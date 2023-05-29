import { AnyProtocol } from '../Protocol'
import { Ref } from '../../Utility'
import { IService } from '../Service'

export type ProtocolExchangeRequestMessage = {
	// The list of protocols we support
	protocols: Ref<AnyProtocol>[]
}

export type ProtocolExchangeResponseMessage = {
	// The list of protocols agree to use
	protocols: Ref<AnyProtocol>[]
}

export interface IProtocolExchangeService extends IService {
	// Exchange our protocols with the remote, returning the selected protocols in the order they should be applied
	initiate(protocols: Ref<AnyProtocol>[]): Promise<Ref<AnyProtocol>[]>
}
