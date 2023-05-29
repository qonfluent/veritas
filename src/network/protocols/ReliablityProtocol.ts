import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type ReliablityOptions = {
	removeDuplicates?: boolean // Remove duplicate messages by tracking hashes
	detectMangled?: boolean // Detect mangled messages with a CRC
	correctMangled?: number // Add a given number of bytes to the message to correct mangled messages
	requireOrder?: boolean // Require messages to be received in order(add order field)
	requireAck?: boolean // Require messages to be acknowledged(add ack messages)
}

export interface IReliablityProtocol extends IProtocol<ReliablityOptions, IReliableConnection> {}
export interface IReliableConnection extends IConnection {}
