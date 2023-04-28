export interface Duplex<Send, Recv = Send> {
	send(message: Send): void
	receive(handler: (message: Recv) => void): void
}

export interface ID {
	toString(): string
}

export class Message {}
