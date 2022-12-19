import assert from "assert";
import { BlockStatement, Concat, Constant, Not, SignalLike, SignalT, Ternary } from "gateware-ts";

export function rangeMap<T>(n: number, body: (i: number) => T): T[] {
	return [...Array(n)].map((_, i) => body(i))
}

export function rangeFlatMap<T>(n: number, body: (i: number) => T[]): T[] {
	return [...Array(n)].flatMap((_, i) => body(i))
}

export function recordRangeMap<T>(n: number, body: (i: number) => [string, T]): Record<string, T> {
	return Object.fromEntries([...Array(n)].map((_, i) => body(i)))
}

export function recordRangeFlatMap<T>(n: number, body: (i: number) => [string, T][]): Record<string, T> {
	return Object.fromEntries([...Array(n)].flatMap((_, i) => body(i)))
}

export function recordRangeFlatMap2<T>(n: number, m: number, body: (i: number, j: number) => [string, T][]): Record<string, T> {
	return Object.fromEntries([...Array(n)].flatMap((_, i) => [...Array(m)].flatMap((_, j) => body(i, j))))
}

export function signedShiftLeft(signal: SignalLike, shift: number): SignalLike {
	if (shift > 0) {
		return signal ['<<'] (shift)
	} else if (shift < 0) {
		return signal ['>>'] (-shift)
	} else {
		return signal
	}
}

export function indexArray(array: SignalLike[], index: SignalLike, i = 0): SignalLike {
	assert(array.length >= 1)

	if (array.length === 1) {
		return array[0]
	}

	return Ternary(index ['=='] (Constant(index.width, i)), array[0], indexArray(array.slice(1), index, i + 1))
}

export function reverseBits(bits: SignalLike): SignalLike {
	return Concat([...Array(bits.width)].map((_, i) => bits.bit(bits.width - i - 1)))
}

export function clearRegisters(registers: SignalT[]): BlockStatement[] {
	return registers.map((reg) => reg ['='] (Constant(reg.width, 0)))
}

export function logicalOpAll(op: '||' | '&&', values: SignalLike[]): SignalLike {
	switch (values.length) {
		case 0: {
			return Constant(1, 0)
		}
		case 1: {
			return values[0]
		}
		default: {
			return values[0] ['||'] (logicalOpAll(op, values.slice(1)))
		}
	}
}

export function prioritySelector(pairs: [data: SignalLike, match: SignalLike][], width: number): SignalLike {
	if (pairs.length === 0) {
		return Constant(width, 0)
	}

	return Ternary(pairs[0][1], pairs[0][0], prioritySelector(pairs.slice(1), width))
}

export function firstSetIndex(values: SignalLike[], width = Math.ceil(Math.log2(values.length + 1)), index = 0): SignalLike {
	if (values.length === 0) {
		return Constant(width, index)
	}

	return Ternary(values[0], Constant(width, index), firstSetIndex(values.slice(1), width, index + 1))
}

export function setBit(reg: SignalT, index: SignalLike, value: SignalLike): SignalLike {
	return (reg ['&'] (Not(Constant(1, 1) ['<<'] (index)))) ['|'] (value ['<<'] (index))
}
