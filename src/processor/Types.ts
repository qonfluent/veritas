import { Float16Array } from "@petamoriken/float16"
import { Constant, ConstantT, Signal, SignalT, Signedness } from "gateware-ts"

export type Address = number

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

export function typeToSignal(type: DataType): SignalT {
	switch (type.tag) {
		case DataTag.Int: {
			return Signal(type.width, type.signed ? Signedness.Signed : Signedness.Unsigned)
		}
		case DataTag.Float: {
			return Signal(type.width, Signedness.Unsigned)
		}
		case DataTag.Char: {
			return Signal(32, Signedness.Unsigned)
		}
		case DataTag.String: {
			return Signal(128, Signedness.Unsigned)
		}
	}
}

export function  typeWidth(type: DataType): number {
	switch (type.tag) {
		case DataTag.Int:
		case DataTag.Float: {
			return type.width
		}
		case DataTag.Char: {
			return 32
		}
		case DataTag.String: {
			return 128
		}
	}
}

export type DataValueInt = DataTypeInt & {
	value: number | bigint
}

export type DataValueFloat = DataTypeFloat & {
	value: number
}

export type DataValueChar = DataTypeChar & {
	value: string
}

export type DataValueString = DataTypeString & {
	value: Address
	length: number | bigint
}

export type DataValue = DataValueInt | DataValueFloat | DataValueChar | DataValueString

export function encode(value: DataValue): ConstantT {
	switch (value.tag) {
		case DataTag.Int: {
			return Constant(value.width, value.value, value.signed ? Signedness.Signed : Signedness.Unsigned)
		}
		case DataTag.Float: {
			switch (value.width) {
				case 16: {
					const result = new DataView(new Float16Array([value.value])).getInt16(0, true)
					return Constant(16, result)
				}
				case 32: {
					const result = new DataView(new Float32Array([value.value])).getInt32(0, true)
					return Constant(32, result)
				}
				case 64: {
					const result = new DataView(new Float64Array([value.value])).getBigUint64(0, true)
					return Constant(64, result)
				}
			}
		}
		case DataTag.Char: {
			return Constant(32, value.value.codePointAt(0))
		}
		case DataTag.String: {
			return Constant(128, (BigInt(value.length) << BigInt(64)) | BigInt(value.value))
		}
	}
}

export enum ArgTag {
	Reg,
}

export type ArgType = {
	tag: ArgTag
	type: DataType
}

export type ArgSizeMap = Record<ArgTag, number>
