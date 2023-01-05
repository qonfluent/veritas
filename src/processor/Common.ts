import { rangeMap } from '../common/Util'
import { RExpr } from '../hdl/Verilog'

export function flipBits(value: RExpr, bits: number): RExpr {
	return ['concat', rangeMap(bits, (i) => ['index', value, bits - i - 1])]
}
