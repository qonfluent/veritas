import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type AcknowledgedmentOptions = {}

export type AckMessage = {
	// The latest message for which all previous messages have been acknowledged
	baseAck: number

	// The number of messages after the completeAck that have been received
	relativeLastAck: number

	// A bitfield of messages after the completeAck that have been received
	ackBitfield: Uint8Array
}

export interface IAcknowledgedProtocol extends IProtocol<AcknowledgedmentOptions, IAcknowledgedConnection> {}
export interface IAcknowledgedConnection extends IConnection {
	// The latest message for which all previous messages have been acknowledged
	get outboundCompleteAck(): number
	get inboundCompleteAck(): number

	// The lastest message that has been received
	get outboundLastAck(): number
	get inboundLastAck(): number

	// Check if a given message has been acknowledged
	isAckedOutbound(message: number): boolean
	isAckedInbound(message: number): boolean
}
