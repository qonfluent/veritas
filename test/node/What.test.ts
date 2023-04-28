import { Module } from '../../src/Module'
import { LoadModuleMessage, Node, ThreadSpawnedMessage, SpawnMessage, KillThreadMessage, NodeThreadKilledMessage } from '../../src/Node'
import { ThreadDataMessage, ThreadDataResponseMessage, ThreadKilledMessage } from '../../src/Thread'

describe('What', () => {
	it('should work', async () => {
		const node = new Node('test')
		const module = new Module('const { parentPort } = require("worker_threads"); parentPort.on("message", message => parentPort.postMessage(message))')
		
		let threadId = ''
		let spawned = new Promise<void>((resolve) => {
			node.receive(message => {
				if (message instanceof ThreadSpawnedMessage) {
					threadId = message.threadId.toString()
					resolve()
				}
			})
		})

		let echoed = new Promise<void>((resolve) => {
			node.receive(message => {
				if (message instanceof ThreadDataResponseMessage) {
					expect(message.data).toEqual('echo')
					resolve()
				}
			})
		})

		let killed = new Promise<void>((resolve) => {
			node.receive(message => {
				if (message instanceof NodeThreadKilledMessage) {
					expect(message.nodeId.toString()).toEqual(node.id)
					expect(message.threadId.toString()).toEqual(threadId)
					resolve()
				}
			})
		})

		node.send(new LoadModuleMessage(node.id, module))
		node.send(new SpawnMessage(node.id, module.id))
		await spawned
		node.send(new ThreadDataMessage(threadId, 'echo'))
		await echoed
		node.send(new KillThreadMessage(threadId))
		await killed
	})
})
