import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type DemanglingOptions = {}
export interface IDemanglingProtocol extends IProtocol<DemanglingOptions, IDemangledConnection> {}
export interface IDemangledConnection extends IConnection {}
