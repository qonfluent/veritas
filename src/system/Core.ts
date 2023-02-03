import assert from "assert"

// This forms the lowest level of the system, the core syntax. The core syntax is designed to be a superset of all other
// syntaxes, and is used to define the syntaxes of other systems. The core syntax is also used to define the syntax of
// the system itself, which is used to define the syntax of other systems. This is a recursive definition, which is
// why the core syntax is defined togethere here.

// Generic syntax value, which is required to have at least a text and bytes representation
// as well as a type, which is defined later
export interface SyntaxValue {
	get type(): SyntaxType
	get text(): TextValue
	get bytes(): BytesValue
}

// A symbol is an uninterpreted value. It has a name and a type, 
export class Symbol implements SyntaxValue {
	public constructor(
		private readonly _name: string,
		private readonly _type: SyntaxType = SyntaxTags.Symbol,
	) {}

	public get name(): string {
		return this._name
	}

	public get type(): SyntaxType {
		return this._type
	}

	public get text(): TextValue {
		return new TextValue(this._name)
	}

	public get bytes(): BytesValue {
		throw new Error('Not yet implemented')
	}
}

// A symbol used to tag syntax types
export class SyntaxType extends Symbol {
	public constructor(
		name: string,
		private readonly _encoder: TextEncoderValue = TextEncoderValue.DefaultTextEncoder,
	) {
		super(name, SyntaxTags.SyntaxType)
	}
}

export class TextEncoderValue extends Symbol {
	public static readonly DefaultTextEncoder = new TextEncoderValue('Core.TextEncoder.Default')

	public constructor(
		name: string,
	) {
		super(name, SyntaxTags.TextEncoder)
	}

	public encode(text: string): Uint8Array {
		return new TextEncoder().encode(text)
	}

	public decode(bytes: Uint8Array): string {
		return new TextDecoder().decode(bytes)
	}
}

// A text value is a string of characters with a known encoding
export class TextValue implements SyntaxValue {
	public constructor(
		private readonly _text: string,
		private readonly _encoding: TextEncoderValue = TextEncoderValue.DefaultTextEncoder,
	) {
	}

	public get value(): string {
		return this._text
	}

	public get type(): SyntaxType {
		return SyntaxTags.Text
	}

	public get text(): TextValue {
		return this
	}

	public get bytes(): BytesValue {
		throw new Error('Not yet implemented')
	}
}

// A bytes value is a sequence of bytes
export class BytesValue implements SyntaxValue {
	public constructor(
		private readonly _bytes: Uint8Array,
	) {}

	public get value(): Uint8Array {
		return this._bytes
	}

	public get type(): SyntaxType {
		return SyntaxTags.Bytes
	}

	public get text(): TextValue {
		return new TextValue(this._bytes.toString())
	}

	public get bytes(): BytesValue {
		return this
	}

	public get length(): number {
		return this._bytes.length
	}

	public toString(): string {
		return Buffer.from(this._bytes).toString('hex')
	}
}

// The tags for the core syntax types, recorded in one place for easy reference
export class SyntaxTags {
	public static readonly SyntaxType = new SyntaxType('Core.SyntaxType')
	public static readonly TextEncoder = new SyntaxType('Core.TextEncoder')
	public static readonly Symbol = new SyntaxType('Core.Symbol')
	public static readonly Text = new SyntaxType('Core.Text')
	public static readonly Bytes = new SyntaxType('Core.Bytes')
}

// NOTE: The TextValue and BytesValue types are provided for small values. For large values, we should use a
// streaming interface and display the first few bytes of the value as a preview, and provide a different
// interface for viewing the full value. That is outside the scope of this file, which is just for the core

// 
// With the types for symbol, text, and byte constants in place, we can define the core syntax. The core syntax is designed
// to allow for easy marking of documents to switch between languages, and to allow for easy embedding of other languages and
// syntaxes within the core syntax. The core syntax is designed to be a superset of all other syntaxes, and to be able to
// represent any other syntax as a subset of the core syntax.
//
// The Core syntax is defined as follows:
// Expression = '@' <Term> <FollowingTerm>*
//
// ConstTerm = <Symbol> | <TextValue> | <BytesValue>
// CompoundTerm = <CompoundTag> (<Term> ','?)* <CompoundUntag>
// DynamicTerm = '{' (.*) '}'
//
// Term = <ConstTerm> | <CompoundTerm> | <DynamicTerm>









// A type system consists of five judgments:
// 1. Gamma in Ctx      (Context definition)
// 2. Gamma |- A : Type (Type definition)
// 3. Gamma |- A = B		(Type equality)
// 4. Gamma |- M : A		(Term definition)
// 5. Gamma |- M = N		(Term equality)

// We reduce this by noting the following:
// 1. A = B : Type -- This can unify 2 with 3 by using the alpha equal term A and B on each side of the equality
// 2. a = b : A -- Same for 4 and 5
// 3. All judgements can have the context embedded directly, so we can remove 1, leaving two judgements total
// 4. Finally, we embed terms in types and make a special Type symbol to represent the type of types
// 5, This leaves out some questions about recursion, but we can handle that later
