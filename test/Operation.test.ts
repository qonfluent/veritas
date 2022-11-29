import { ArgMode, OperationalUnit } from '../src/Operation'
import { DataTag, DataType } from '../src/Types'

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
				return [{ type: intType, value: args[0].value + args[1].value }]
			}
		})

		const r0 = adder.step({ args: [{ type: intType, value: BigInt(1111) }, { type: intType, value: BigInt(2222) }] })
		expect(r0).toEqual({ result: undefined })
		const r1 = adder.step()
		expect(r1).toEqual({ result: [{ type: intType, value: BigInt(3333) }] })
	})
})
