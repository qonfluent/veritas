import { ArgName } from './Processor'

export type Operation = {
	opcode: number
	args: Record<ArgName, number>
}

export type ShortInstruction = {
	shiftBytes?: number
	groups: Operation[][]
}

export type WideInstruction = {
	shiftBytes?: number
	lanes: Operation[]
}
