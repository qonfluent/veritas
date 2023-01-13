import { SignalValue } from '../hdl/HDL'
import { FieldName } from './Processor'

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
