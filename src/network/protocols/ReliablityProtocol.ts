import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type ReliablityOptions = {}
export interface IReliablityProtocol extends IProtocol<ReliablityOptions, IReliableConnection> {}
export interface IReliableConnection extends IConnection {}
