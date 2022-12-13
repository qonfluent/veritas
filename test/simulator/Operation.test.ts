import { ArgMode, OperationalUnit } from '../../src/simulator/Operation'
import { DataTag, DataType } from '../../src/simulator/Types'

describe('Operation', () => {
	it('Adder works', () => {
		const intType: DataType = { tag: DataTag.Int, signed: false, width: 64 }
		const adder = new OperationalUnit({
			argTypes: [
				{
					mode: ArgMode.Reg,
					type: intType,
				},
				{
					mode: ArgMode.Reg,
					type: intType,
				},
			],
			resultTypes: [
				intType,
			],
			startLatency: 1,
			finishLatency: 1,
			body: (args) => {
				if (args[0].tag !== DataTag.Int || args[1].tag !== DataTag.Int) {
					throw new Error()
				}
				return [{ ...intType, value: args[0].value + args[1].value }]
			}
		})

		const r0 = adder.step({ target: 0, args: [{ ...intType, value: BigInt(1111) }, { ...intType, value: BigInt(2222) }] })
		expect(r0).toEqual(undefined)
		const r1 = adder.step()
		expect(r1).toEqual({ target: 0, result: [{ ...intType, value: BigInt(3333) }] })
	})
})
