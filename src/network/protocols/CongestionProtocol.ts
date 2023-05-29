import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type CongestionOptions = {}
export interface ICongestionProtocol extends IProtocol<CongestionOptions, ICongestionConnection> {}
export interface ICongestionConnection extends IConnection {}
