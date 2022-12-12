export type CycleCount = number
export type OpcodeType = number
export type RegisterIndex = number

export enum DataTag {
	Undefined,
	Int,
}

export type DataTypeUndefined = {
	tag: DataTag.Undefined
}

export type DataTypeInt = {
	tag: DataTag.Int
	signed: boolean
	width: 8 | 16 | 32 | 64
}

export type DataType = DataTypeUndefined | DataTypeInt

export function typeEqual(lhs: DataType, rhs: DataType): boolean {
	switch (lhs.tag) {
		case DataTag.Undefined: {
			return lhs.tag === rhs.tag
		}
		case DataTag.Int: {
			return lhs.tag === rhs.tag && lhs.signed === rhs.signed && lhs.width === rhs.width
		}
	}
}

export type DataValueUndefined = DataTypeUndefined

export type DataValueInt = DataTypeInt & {
	value: bigint
}

export type DataValue = DataValueUndefined | DataValueInt
