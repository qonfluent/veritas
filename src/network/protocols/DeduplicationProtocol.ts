import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type DeduplicationOptions = {}
export interface IDeduplicationProtocol extends IProtocol<DeduplicationOptions, IDeduplicatedConnection> {}
export interface IDeduplicatedConnection extends IConnection {}
