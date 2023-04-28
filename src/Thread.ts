import crypto from 'crypto'
import { Worker } from 'worker_threads'
import { Duplex } from './Common'
import { Module } from './Module'
import { KillThreadMessage, Node } from './Node'

export type ThreadID = string

export class Thread implements Duplex<ThreadMessage, ThreadResponseMessage> {
	private readonly _id: ThreadID
	private readonly _worker: Worker
	private readonly _handlers: ((message: ThreadResponseMessage) => void)[] = []

	public constructor(
		private readonly _node: Node,
		private readonly _base: Module,
	) {
		const nonce = crypto.randomBytes(16).toString('hex')
		const path = `${_node.id}/${_base.id}/${nonce}`
		const hash = crypto.createHash('sha256').update(path).digest('hex')
		this._id = `thread/sha256-${hash}`
		
		this._worker = new Worker(_base.code, { eval: true })
		this._worker.on('message', (message: ThreadDataResponseMessage) => {
			this._handlers.forEach(handler => handler(new ThreadDataResponseMessage(message.threadId, message.data)))
		})
	}

	public get base(): Module {
		return this._base
	}

	public get id(): ThreadID {
		return this._id
	}

	public kill(sendToNode = true): void {
		this._worker.terminate()
		this._handlers.forEach(handler => handler(new ThreadKilledMessage(this._id)))
		if (sendToNode) {
			this._node.send(new KillThreadMessage(this._id))
		}
	}

	public send(
		message: ThreadMessage,
	): void {
		this._worker.postMessage(message)
	}

	public receive(
		handler: (message: ThreadMessage) => void,
	): void {
		this._handlers.push(handler)
	}
}

export class ThreadMessage {
	public constructor(
		public readonly threadId: ThreadID,
	) {}
}
export class ThreadDataMessage extends ThreadMessage {
	public constructor(
		threadId: ThreadID,
		public readonly data: any,
	) {
		super(threadId)
	}
}

export class ThreadResponseMessage {
	public constructor(
		public readonly threadId: ThreadID,
	) {}
}
export class ThreadKilledMessage extends ThreadResponseMessage {
	public constructor(
		threadId: ThreadID,
	) {
		super(threadId)
	}
}
export class ThreadDataResponseMessage extends ThreadResponseMessage {
	public constructor(
		public readonly threadId: ThreadID,
		public readonly data: any,
	) {
		super(threadId)
	}
}
