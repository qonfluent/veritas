import { SignalT, BlockStatement, Constant, SignalLike, Concat } from "gateware-ts"

export function clearRegs(regs: SignalT[]): BlockStatement[] {
	return regs.map((reg) => reg ['='] (Constant(reg.width, 0)))
}

export function maintainRegs(regs: SignalT[]): BlockStatement[] {
	return regs.map((reg) => reg ['='] (reg))
}

export function reverseBits(bits: SignalLike): SignalLike {
	return Concat([...Array(bits.width)].map((_, i) => bits.bit(bits.width - i - 1)))
}
