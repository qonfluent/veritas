import { TypedEmitter } from 'tiny-typed-emitter'

export interface Duplex<T> extends Readable<T>, Writable<T> {}

export interface Writable<T> {
	write(value: T): Promise<void>
}

export interface ReadableEvents<T> {
	'data': (value: T) => void
	'end': () => void
	'error': (error: Error) => void
	'close': () => void
}

export interface Readable<T> extends TypedEmitter<ReadableEvents<T>> {}
