export enum Tag {
	Bool,
	Char,
	String,

	FixInt,
	FixReal,
	Finite,
	Infinite,
	Ratio,
	Complex,

	Seq,
	
	Union,
	Intersection,

	Func,
	Var,
	Apply,
}

export type SimpleNumericType
	= { tag: Tag.FixInt, bits?: number, signed: boolean }
	| { tag: Tag.FixReal, bits?: number, signed: boolean }
	| { tag: Tag.Finite, count: bigint }
	| { tag: Tag.Infinite, signed: boolean, integer: boolean }

export type RatioNumericType
	= SimpleNumericType
	| { tag: Tag.Ratio, numerator: SimpleNumericType, denominator: SimpleNumericType }

export type ComplexNumericType
	= RatioNumericType
	| { tag: Tag.Complex, real: RatioNumericType, imaginary: RatioNumericType }

export type SimpleType
	= { tag: Tag.Bool }
	| { tag: Tag.Char }
	| { tag: Tag.String }
	| ComplexNumericType

export type Type
	= SimpleType
	// Simple sequences(i.e. List<A>, Vect<N, A>, Set<A>, FinSet<N, A>)
	| { tag: Tag.Seq, ordered: boolean, element: Type, count: bigint | undefined }
	// Maps(i.e. Map<K, V>, FinMap<N, K, V>, OrdMap<K, V>, FinOrdMap<N, K, V>)
	| { tag: Tag.Seq, ordered: boolean, key: Type, value: Type, count: bigint | undefined }
	// Tuples(i.e. HList<A, B, C, ...>, HVect<N, A, B, C, ...>, HSet<A, B, C, ...>, HFinSet<N, A, B, C, ...>)
	| { tag: Tag.Seq, ordered: boolean, elements: Type[], count: bigint | undefined }
	// Records(i.e. Record<A, B, C, ...>, FinRecord<N, A, B, C, ...>)
	| { tag: Tag.Seq, ordered: boolean, fields: Record<string, Type>, count: bigint | undefined }
	// Unions(i.e. Union<A, B, C, ...>) and Intersections(i.e. Intersection<A, B, C, ...>)
	| { tag: Tag.Union | Tag.Intersection, elements: Type[] }
	// Functions(i.e. Func<R, A, B, C, ...>)
	| { tag: Tag.Func, return: Type, args: Type[] }
	// Variables
	| { tag: Tag.Var, var: string }
	// Applications(i.e. Apply<F, A, B, C, ...>)
	| { tag: Tag.Apply, func: Type, args: Type[] }

// Infinite values are represented using a number followed by an array of infinite values
// Each number represents the order of the hyper operation being applied to the inner values
// [0, []] = infinity, [1, []] = infinity^2, [2, []] = infinity ^ infinity, [3, []] = (hyper power of infinity), etc
export type InfiniteValue = bigint | [number, ...InfiniteValue[]]

export type BaseNumericValue
	= { tag: Tag.FixInt, value: bigint }
	| { tag: Tag.FixReal, value: bigint, expt: number }
	| { tag: Tag.Finite, value: bigint }
	| { tag: Tag.Infinite, value: InfiniteValue }

export type BaseRatioValue
	= BaseNumericValue
	| { tag: Tag.Ratio, numerator: BaseNumericValue, denominator: BaseNumericValue }

export type BaseComplexValue
	= BaseRatioValue
	| { tag: Tag.Complex, real: BaseRatioValue, imaginary: BaseRatioValue }

export type SimpleValue
	= { tag: Tag.Bool, value: boolean }
	| { tag: Tag.Char, value: string }
	| { tag: Tag.String, value: string }
	| BaseComplexValue

export type Value
	= SimpleValue
	| { tag: Tag.Seq, seq: Value[] }
	| { tag: Tag.Seq, rec: Record<string, Value> }
	| { tag: Tag.Seq, set: Set<Value> }
	| { tag: Tag.Seq, map: Map<Value, Value> }
