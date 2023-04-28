import { Duplex, Message } from './Common'
import { Module, ModuleID } from './Module'
import { Thread, ThreadDataMessage, ThreadDataResponseMessage, ThreadID } from './Thread'

export type NodeID = string

export class Node implements Duplex<NodeMessage, NodeResponseMessage> {
	private readonly _modules: Record<string, Module> = {}
	private readonly _threads: Record<string, Thread> = {}
	private readonly _handlers: ((message: NodeResponseMessage) => void)[] = []

	public constructor(
		private readonly _id: NodeID,
	) {}

	public get id(): NodeID {
		return this._id
	}

	public send(
		message: NodeMessage,
	): void {
		if (message instanceof SpawnMessage) {
			this._spawn(message.moduleId)
		} else if (message instanceof NodeKillThreadMessage) {
			this._kill(message.threadId)
		} else if (message instanceof LoadModuleMessage) {
			this._modules[message.module.id.toString()] = message.module
		} else if (message instanceof UnloadModuleMessage) {
			delete this._modules[message.moduleId.toString()]
		} else if (message instanceof NodeThreadDataMessage) {
			this._send(new ThreadDataMessage(message.threadId, message.data))
		} else {
			throw new Error(`Unknown message type ${message.type}`)
		}
	}

	public receive(
		handler: (message: NodeMessage) => void,
	): void {
		this._handlers.push(handler)
	}

	private _spawn(
		moduleId: ModuleID,
	): void {
		const module = this._modules[moduleId.toString()]
		if (!module) {
			throw new Error(`Module ${moduleId} not found`)
		}

		const thread = new Thread(this, module)
		thread.receive((message) => {
			if (message instanceof ThreadDataResponseMessage) {
				this._handlers.forEach(handler => handler(new NodeThreadDataResponseMessage(this.id, thread.id, message.data)))
			}
		})
		this._threads[thread.id.toString()] = thread

		this._handlers.forEach(handler => handler(new NodeThreadSpawnedMessage(this.id, thread.id)))
	}

	private _kill(
		threadId: ThreadID,
	): void {
		const thread = this._threads[threadId.toString()]
		if (!thread) {
			throw new Error(`Thread ${threadId} not found`)
		}

		thread.kill(false)
		delete this._threads[threadId.toString()]

		this._handlers.forEach(handler => handler(new NodeThreadKilledMessage(this.id, threadId)))
	}

	private _send(
		message: ThreadDataMessage,
	): void {
		const thread = this._threads[message.threadId.toString()]
		if (!thread) {
			throw new Error(`Thread ${message.threadId} not found`)
		}

		thread.send(message)
	}
}

// Messages to the node
export class NodeMessage extends Message {}
export class LoadModuleMessage extends NodeMessage {
	public constructor(
		public readonly nodeId: NodeID,
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
		public readonly nodeId: NodeID,
		public readonly moduleId: ModuleID,
	) {
		super()
	}
}
export class NodeKillThreadMessage extends NodeMessage {
	public constructor(
		public readonly nodeId: NodeID,
		public readonly threadId: ThreadID,
	) {
		super()
	}
}
export class NodeThreadDataMessage extends NodeMessage {
	public constructor(
		public readonly nodeId: NodeID,
		public readonly threadId: ThreadID,
		public readonly data: any,
	) {
		super()
	}
}

// Messages from the node
export class NodeResponseMessage extends Message {}
export class NodeThreadSpawnedMessage extends NodeResponseMessage {
	public constructor(
		public readonly nodeId: NodeID,
		public readonly threadId: ThreadID,
	) {
		super()
	}
}
export class NodeThreadKilledMessage extends NodeResponseMessage {
	public constructor(
		public readonly nodeId: NodeID,
		public readonly threadId: ThreadID,
	) {
		super()
	}
}
export class NodeThreadDataResponseMessage extends NodeResponseMessage {
	public constructor(
		public readonly nodeId: NodeID,
		public readonly threadId: ThreadID,
		public readonly data: any,
	) {
		super()
	}
}
