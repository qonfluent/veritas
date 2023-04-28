import crypto from 'crypto'

export interface Duplex<Send, Recv = Send> {
	send(message: Send): void
	receive(handler: (message: Recv) => void): void
}

export type MessageID = string
export type TypeID = string

export class Message {
	public get id(): MessageID {
		const hash = crypto.createHash('sha256').update(JSON.stringify({ '@type': this.type, ...this })).digest('hex')
		return `message/sha256-${hash}`
	}

	public get type(): TypeID {
		return this.constructor.name
	}
}
