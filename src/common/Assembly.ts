import { SignalValue } from '../hdl/HDL'
import { DecoderFieldDesc, FieldName } from './Processor'

export type RegisterIndex = number

export type InstructionField = number | RegisterIndex

export type InstructionGroup = {
	extra?: SignalValue
	fields: Record<FieldName, InstructionField>
}

export type Instruction = {
	invalid: number
} | {
	extra?: SignalValue
	groups: InstructionGroup[]
}

export type OperationDesc = {
	opcode: string
	args: DecoderFieldDesc[]
}

export type Operation = {
	opcode: string
	args: InstructionField[]
}

export type Block = {
	operations: Operation[]
}

export type Program = {
	blocks: Block[]
}
