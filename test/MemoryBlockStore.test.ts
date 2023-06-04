import crypto from 'crypto'
import { pack } from 'msgpackr'
import { Block } from '../src/block/BlockStore'
import { MemoryBlockStore } from '../src/block/MemoryBlockStore'

describe('Test', () => {
	it('should work', () => {
		const store = new MemoryBlockStore((block) => crypto.createHash('sha256').update(pack(block)).digest(), () => true, () => {})
		const node1 = crypto.randomBytes(32)
		const node2 = crypto.randomBytes(32)

		const block1: Block = { parents: [], data: pack({ node: node1 }), signature: crypto.randomBytes(32) }
		const id1 = store.add(block1)
		const cursor1 = store.getCursor()
		expect(cursor1).toEqual(new Map([[node1, 1]]))

		const block2: Block = { parents: [], data: pack({ node: node2 }), signature: crypto.randomBytes(32) }
		const id2 = store.add(block2)
		const cursor2 = store.getCursor()
		expect(cursor2).toEqual(new Map([[node1, 1], [node2, 1]]))

		const block3: Block = { parents: [id1, id2], data: Buffer.from('Hello world'), signature: crypto.randomBytes(32) }
		const id3 = store.add(block3)
		const cursor3 = store.getCursor()
		expect(cursor3).toEqual(new Map([[node1, 2], [node2, 1]]))

		const delta1 = store.getDelta(cursor1)
		expect(delta1).toEqual([block2, block3])

		const delta2 = store.getDelta(cursor2)
		expect(delta2).toEqual([block3])
	})
})
