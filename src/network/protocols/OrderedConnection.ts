import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type OrderedOptions = {}
export interface IOrderedProtocol extends IProtocol<OrderedOptions, IOrderedConnection> {}
export interface IOrderedConnection extends IConnection {
	get outboundSequence(): number
	get inboundSequence(): number
}
