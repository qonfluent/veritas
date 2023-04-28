import { Module } from '../../src/Module'
import { LoadModuleMessage, Node, NodeID, NodeSpawnedMessage, SpawnMessage } from '../../src/Node'
import { ThreadDataMessage } from '../../src/Thread'

describe('What', () => {
	it('should work', async () => {
		const node = new Node(new NodeID('node'))
		const module = new Module('const { parentPort } = require("worker_threads"); parentPort.on("message", message => parentPort.postMessage(message))')
		node.send(new LoadModuleMessage(module))
		node.send(new SpawnMessage(module.id))
		node.receive(message => {
			if (message instanceof NodeSpawnedMessage) {
				const thread = message.id
				node.send(new ThreadDataMessage(thread, 'Hello, world!'))
				node.receive(message => {
					if (message instanceof ThreadDataMessage) {
						expect(message.data).toBe('Hello, world!')
					}
				})
			}
		})
	})
})
