import { rangeMap } from "../Util"
import { RExpr } from "./Verilog"

export function reverseBits(value: RExpr, bits: number): RExpr {
	return { concat: rangeMap(bits, (i) => ({ index: value, start: i })) }
}

export function signedShift(value: RExpr, bits: number): RExpr {
	if (bits === 0) {
		return value
	}

	return { binary: bits > 0 ? '<<' : '>>', left: value, right: Math.abs(bits) }
}

export function indexTable(table: RExpr[], index: RExpr, offset = 0): RExpr {
	if (table.length === 0) {
		throw new Error('Cannot index empty table')
	}

	if (table.length === 1) {
		return table[0]
	}

	return { ternary: { index, start: offset }, zero: indexTable(table.slice(0, table.length / 2), index, offset + 1), one: indexTable(table.slice(table.length / 2), index, offset + 1) }
}
