import { ArgName } from './Processor'

export type Operation = {
	opcode: number
	args: Record<ArgName, number>
}

export type Instruction = {
	groups: Operation[][]
}
