import { Duplex, ID, Message } from './Common'
import { Module, ModuleID } from './Module'
import { Thread, ThreadID } from './Thread'

export class NodeID implements ID {
	public constructor(
		private readonly _id: string,
	) {}

	public toString(): string {
		return `node/${this._id}`
	}
}

export class Node implements Duplex<NodeMessage, NodeResponseMessage> {
	private _nonce: number = 0
	private readonly _modules: Record<string, Module> = {}
	private readonly _threads: Record<string, Thread> = {}
	private readonly _handlers: ((message: NodeMessage) => void)[] = []

	public constructor(
		private readonly _id: NodeID,
	) {}

	public get id(): NodeID {
		return this._id
	}

	public send(
		message: NodeMessage,
	): void {
		try {
			if (message instanceof SpawnMessage) {
				const module = this._modules[message.moduleId.toString()]
				if (!module) {
					throw new Error(`Module ${message.moduleId} not found`)
				}

				const thread = new Thread(this, module, this._nonce++)
				this._threads[thread.id.toString()] = thread

				this._handlers.forEach(handler => handler(new NodeSpawnedMessage(thread.id)))
			} else if (message instanceof KillThreadMessage) {
				const thread = this._threads[message.threadId.toString()]
				if (!thread) {
					throw new Error(`Thread ${message.threadId} not found`)
				}

				thread.kill(false)
				delete this._threads[message.threadId.toString()]

				this._handlers.forEach(handler => handler(new NodeThreadKilledMessage(thread.id)))
			} else if (message instanceof LoadModuleMessage) {
				this._modules[message.module.id.toString()] = message.module
			} else if (message instanceof UnloadModuleMessage) {
				delete this._modules[message.moduleId.toString()]
			} else {
				throw new Error(`Unrecognized message type ${message}`)
			}
		} catch (error) {
			this._handlers.forEach(handler => handler(new NodeErrorMessage(error)))
		}
	}

	public receive(
		handler: (message: NodeMessage) => void,
	): void {
		this._handlers.push(handler)
	}
}

// Messages to the node
export class NodeMessage extends Message {}
export class LoadModuleMessage extends NodeMessage {
	public constructor(
		public readonly module: Module,
	) {
		super()
	}
}
export class UnloadModuleMessage extends NodeMessage {
	public constructor(
		public readonly moduleId: ModuleID,
	) {
		super()
	}
}
export class SpawnMessage extends NodeMessage {
	public constructor(
		public readonly moduleId: ModuleID,
	) {
		super()
	}
}
export class KillThreadMessage extends NodeMessage {
	public constructor(
		public readonly threadId: ThreadID,
	) {
		super()
	}
}

// Messages from the node
export class NodeResponseMessage extends Message {}
export class NodeSpawnedMessage extends NodeResponseMessage {
	public constructor(
		public readonly id: ThreadID,
	) {
		super()
	}
}
export class NodeThreadKilledMessage extends NodeResponseMessage {
	public constructor(
		public readonly id: ThreadID,
	) {
		super()
	}
}
export class NodeErrorMessage extends NodeResponseMessage {
	public constructor(
		public readonly error: unknown,
	) {
		super()
	}
}
