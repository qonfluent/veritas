import { Module } from '../../src/Module'
import { LoadModuleMessage, Node, SpawnMessage, NodeThreadKilledMessage, NodeKillThreadMessage, NodeThreadSpawnedMessage, UnloadModuleMessage, NodeThreadDataMessage, NodeThreadDataResponseMessage } from '../../src/Node'

describe('What', () => {
	it('should work', async () => {
		const node = new Node('test')
		const module = new Module('const { parentPort } = require("worker_threads"); parentPort.on("message", message => parentPort.postMessage(message))')
		
		let threadId = ''
		let spawned = new Promise<void>((resolve) => {
			node.receive(message => {
				if (message instanceof NodeThreadSpawnedMessage) {
					expect(message.nodeId.toString()).toEqual(node.id)
					threadId = message.threadId.toString()
					resolve()
				}
			})
		})

		let echoed = new Promise<void>((resolve) => {
			node.receive(message => {
				if (message instanceof NodeThreadDataResponseMessage) {
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
		node.send(new NodeThreadDataMessage(node.id, threadId, 'echo'))
		await echoed
		node.send(new NodeKillThreadMessage(node.id, threadId))
		await killed
		node.send(new UnloadModuleMessage(module.id))
		expect(() => node.send(new SpawnMessage(node.id, module.id))).toThrow()
	})
})
