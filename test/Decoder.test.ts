import { BitStream } from '../src/BitStream'
import { DecoderUnit } from '../src/Decoder'
import { DecoderTree } from '../src/DecoderTree'
import { ArgMode, ModeSizeMap, OperationDesc } from '../src/Operation'

describe('Decoder', () => {
	it('Can decode simple entry', () => {
		const modeSizes: ModeSizeMap = {
			[ArgMode.Reg]: 4,
		}

		const entries: OperationDesc[] = [
			{
				argTypes: [],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			}
		]

		const decoder = new DecoderUnit({
			shiftBits: 4,
			modeSizes,
			groups: [
				{
					lanes: 1,
					decoder: new DecoderTree(entries, modeSizes),
					ops: entries,
				}
			],
		})

		const result = decoder.step({ instruction: new BitStream(new Uint8Array([0])) })
		console.log(JSON.stringify(result))
	})

	it('Can decode more complex entry', () => {
		const modeSizes: ModeSizeMap = {
			[ArgMode.Reg]: 4,
		}

		const entries: OperationDesc[] = [
			{
				argTypes: [],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
			{
				argTypes: [],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
			{
				argTypes: [],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
			{
				argTypes: [],
				resultTypes: [],
				startLatency: 1,
				finishLatency: 1,
				body: () => [],
			},
		]

		const decoder = new DecoderUnit({
			shiftBits: 4,
			modeSizes,
			groups: [
				{
					lanes: 1,
					decoder: new DecoderTree(entries, modeSizes),
					ops: entries,
				}
			],
		})

		const result = decoder.step({ instruction: new BitStream(new Uint8Array([0])) })
		console.log(JSON.stringify(result))
	})
})
