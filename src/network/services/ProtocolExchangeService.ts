import { AnyProtocol, IProtocol } from '../Protocol'
import { Ref } from '../Ref'
import { IService } from '../Service'

export interface IProtocolExchangeService extends IService {
	// Exchange our protocols with the remote, returning the selected protocols in the order they should be applied
	initiate(protocols: Ref<AnyProtocol>[]): Promise<Ref<AnyProtocol>[]>
}
