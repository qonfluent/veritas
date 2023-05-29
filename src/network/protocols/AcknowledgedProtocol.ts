import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type AcknowledgedmentOptions = {}

export interface IAcknowledgedProtocol extends IProtocol<AcknowledgedmentOptions, IAcknowledgedConnection> {}
export interface IAcknowledgedConnection extends IConnection {}
