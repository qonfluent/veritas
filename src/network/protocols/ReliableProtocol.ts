import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type ReliablityOptions = {}
export interface IReliableProtocol extends IProtocol<ReliablityOptions, IReliableConnection> {}
export interface IReliableConnection extends IConnection {}
