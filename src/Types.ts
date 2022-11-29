export enum DataTypeTag {
	Int,
	Float,
}

export type DataTypeInt = {
	tag: DataTypeTag.Int
	signed: boolean
	width: 8 | 16 | 32 | 64
}

export type DataTypeFloat = {
	tag: DataTypeTag.Float
	width: 16 | 32 | 64
}

export type DataType = DataTypeInt | DataTypeFloat

export type DataValue = {
	type: DataTypeInt
	value: number | bigint
} | {
	type: DataTypeFloat
	value: number
}

export function typeEqual(lhs: DataType, rhs: DataType): boolean {
	switch (lhs.tag) {
		case DataTypeTag.Int: {
			return lhs.tag === rhs.tag && lhs.signed === rhs.signed && lhs.width === rhs.width
		}
		case DataTypeTag.Float: {
			return lhs.tag === rhs.tag && lhs.width === rhs.width
		}
	}
}

export function dataTypeBytes(type: DataType): number {
	switch (type.tag) {
		case DataTypeTag.Int:
		case DataTypeTag.Float: {
			switch (type.width) {
				case 8: return 1
				case 16: return 2
				case 32: return 4
				case 64: return 8
			}
		}
	}
}
