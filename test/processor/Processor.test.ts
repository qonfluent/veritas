import { Constant, ConstantT } from "gateware-ts"

export enum DataTag {
	Int,
	Float,
	Char,
	String,
}

export type DataTypeInt = {
	tag: DataTag.Int
	signed: boolean
	width: 8 | 16 | 32 | 64
}

export type DataTypeFloat = {
	tag: DataTag.Float
	width: 16 | 32 | 64
}

export type DataTypeChar = {
	tag: DataTag.Char
}

export type DataTypeString = {
	tag: DataTag.String
}

export type DataType = DataTypeInt | DataTypeFloat | DataTypeChar | DataTypeString

export type DataValueInt = {
	type: DataTypeInt
	value: number | bigint
}

export type DataValueFloat = {
	type: DataTypeFloat
	value: number
}

export type DataValueChar = {
	type: DataTypeChar
	value: string
}

export type DataValueString = {
	type: DataTypeString
	value: string
}

export type DataValue = DataValueInt | DataValueFloat | DataValueChar | DataValueString

describe('Operational Unit', () => {
	it('Works', () => {
	})
})
