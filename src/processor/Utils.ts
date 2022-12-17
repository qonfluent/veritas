import assert from "assert"
import { SignalT, BlockStatement, Constant, SignalLike, Concat, Ternary } from "gateware-ts"

export function clearRegs(regs: SignalLike[]): BlockStatement[] {
	return regs.map((reg) => reg ['='] (Constant(reg.width, 0)))
}

export function maintainRegs(regs: SignalT[]): BlockStatement[] {
	return regs.map((reg) => reg ['='] (reg))
}

export function reverseBits(bits: SignalLike): SignalLike {
	return Concat([...Array(bits.width)].map((_, i) => bits.bit(bits.width - i - 1)))
}

export function orAll(ports: SignalLike[]): SignalLike {
	assert(ports.length >= 1)

	if (ports.length === 1) {
		return ports[0]
	}

	return ports[0] ['|'] (orAll(ports.slice(1)))
}

export function andAll(ports: SignalLike[]): SignalLike {
	assert(ports.length >= 1)

	if (ports.length === 1) {
		return ports[0]
	}

	return ports[0] ['&'] (andAll(ports.slice(1)))
}

export function muxAll(ports: { data: SignalLike, select: SignalLike }[]): SignalLike {
	assert(ports.length >= 1)

	if (ports.length === 1) {
		return Ternary(ports[0].select, ports[0].data, Constant(undefined, 0))
	}

	return Ternary(ports[0].select, ports[0].data, muxAll(ports.slice(1)))
}

export function findFirstSet(ports: SignalLike[], i = 0, width = Math.ceil(Math.log2(ports.length))): SignalLike {
	assert(ports.length >= 1)

	if (ports.length === 1) {
		return Constant(width, i)
	}

	return Ternary(ports[0], Constant(width, i), findFirstSet(ports.slice(1), i + 1, width))
}

export function indexArray(array: SignalLike[], index: SignalLike, i = 0): SignalLike {
	assert(array.length >= 1)

	if (array.length === 1) {
		return array[0]
	}

	return Ternary(index ['=='] (Constant(index.width, i)), array[0], indexArray(array.slice(1), index, i + 1))
}
