import { Worker } from 'worker_threads'
import { Duplex, ID } from './Common'
import { Module, ModuleID } from './Module'
import { KillThreadMessage, Node, NodeID } from './Node'

export class ThreadID implements ID {
	public constructor(
		private readonly _node: NodeID,
		private readonly _module: ModuleID,
		private readonly _id: number,
	) {}

	public toString(): string {
		return `${this._node.toString()}/thread/${this._module.toString()}/${this._id}`
	}

	public get node(): NodeID {
		return this._node
	}

	public get module(): ModuleID {
		return this._module
	}

	public get id(): number {
		return this._id
	}
}

export class Thread implements Duplex<ThreadMessage, ThreadResponseMessage> {
	private readonly _id: ThreadID
	private readonly _worker: Worker
	private readonly _handlers: ((message: ThreadMessage) => void)[] = []

	public constructor(
		private readonly _node: Node,
		private readonly _base: Module,
		nonce: number,
	) {
		this._id = new ThreadID(_node.id, _base.id, nonce)
		this._worker = new Worker(_base.code, { eval: true })
		this._worker.on('message', (message: ThreadMessage) => {
			this._handlers.forEach(handler => handler(message))
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

export class ThreadMessage {}
export class ThreadDataMessage extends ThreadMessage {
	public constructor(
		public readonly threadId: ThreadID,
		public readonly data: any,
	) {
		super()
	}
}

export class ThreadResponseMessage {}
export class ThreadKilledMessage extends ThreadResponseMessage {
	public constructor(
		public readonly threadId: ThreadID,
	) {
		super()
	}
}
