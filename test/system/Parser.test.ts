export class Codec<A, B> {}

export class FuncCodec<A, B> extends Codec<A, B> {
	public constructor(
		public readonly forward: (a: A) => B | undefined,
		public readonly backward: (b: B) => A | undefined,
	) {
		super()
	}
}

export interface Parser {
	// Category
	id<A>(): Codec<A, A>
	seq<A, B, C>(ab: Codec<A, B>, bc: Codec<B, C>): Codec<A, C>
	
	// Iso
	flip<A, B>(codec: Codec<A, B>): Codec<B, A>
	
	// Alt(needs a better data type, this is just a hack)
	altn<A>(...alts: Codec<A, any>[]): Codec<A, [number, any]>
	
	// Pairs
	fst<A, B, C>(codec: Codec<A, B>): Codec<[A, C], [B, C]>
	snd<A, B, C>(codec: Codec<A, B>): Codec<[C, A], [C, B]>
	assocr<A, B, C>(): Codec<[[A, B], C], [A, [B, C]]>
	assocl<A, B, C>(): Codec<[A, [B, C]], [[A, B], C]>

	// Lists
	nil<A, B>(): Codec<B, [A[], B]>
	cons<A, B>(): Codec<[[A, A[]], B], [A[], B]>
	star<A, B>(codec: Codec<A, [B, A]>): Codec<A, [B[], A]>

	// String
	str(s: string): Codec<string, string>
	regexp(r: RegExp): Codec<string, [string, string]>
	parens<A>(parens: [string, string][], codec: Codec<string, [A, string]>): Codec<string, [[string, A, string], string]>

	// Recursion
	var<A, B>(name: string): Codec<A, B>
	define<A, B>(name: string, codec: Codec<A, B>): void
}

export function seqMaybe<A, B, C>(ab: (a: A) => B | undefined, bc: (b: B) => C | undefined): (a: A) => C | undefined {
	return (a) => {
		const b = ab(a)
		return b === undefined ? undefined : bc(b)
	}
}

export class ParserEval implements Parser {
	public id<A>(): FuncCodec<A, A> {
		return new FuncCodec((a) => a, (a) => a)
	}

	public seq<A, B, C>(ab: FuncCodec<A, B>, bc: FuncCodec<B, C>): FuncCodec<A, C> {
		return new FuncCodec(seqMaybe(ab.forward, bc.forward), seqMaybe(bc.backward, ab.backward))
	}

	public flip<A, B>(codec: FuncCodec<A, B>): FuncCodec<B, A> {
		return new FuncCodec(codec.backward, codec.forward)
	}

	public altn<A>(...alts: FuncCodec<A, any>[]): FuncCodec<A, [number, any]> {
		return new FuncCodec(
			(a) => {
				for (let i = 0; i < alts.length; i++) {
					const b = alts[i].forward(a)
					if (b !== undefined) {
						return [i, b]
					}
				}

				return undefined
			},
			([i, b]) => {
				return alts[i].backward(b)
			}
		)
	}

	public star<A, B>(codec: FuncCodec<A, [B, A]>): FuncCodec<A, [B[], A]> {
		return new FuncCodec(
			(a) => {
				// Repeat until we can't parse any more, dumping the results into an array.
				const bs: B[] = []
				while (true) {
					const b = codec.forward(a)
					if (b === undefined || b[1] === a) {
						return [bs, a]
					}

					bs.push(b[0])
					a = b[1]
				}
			},
			([bs, a]) => {
				// Reverse the array, then parse each element in turn, 
				for (const b of bs.reverse()) {
					const a2 = codec.backward([b, a])
					if (a2 === undefined) {
						return undefined
					}

					a = a2
				}

				return a
			}
		)
	}

	public fst<A, B, C>(codec: FuncCodec<A, B>): FuncCodec<[A, C], [B, C]> {
		return new FuncCodec(
			([a, c]: [A, C]): [B, C] | undefined => {
				const b = codec.forward(a)
				return b === undefined ? undefined : [b, c]
			},
			([b, c]: [B, C]): [A, C] | undefined => {
				const a = codec.backward(b)
				return a === undefined ? undefined : [a, c]
			}
		)
	}

	public snd<A, B, C>(codec: FuncCodec<A, B>): FuncCodec<[C, A], [C, B]> {
		return new FuncCodec(
			([c, a]: [C, A]): [C, B] | undefined => {
				const b = codec.forward(a)
				return b === undefined ? undefined : [c, b]
			},
			([c, b]: [C, B]): [C, A] | undefined => {
				const a = codec.backward(b)
				return a === undefined ? undefined : [c, a]
			}
		)
	}

	public assocr<A, B, C>(): FuncCodec<[[A, B], C], [A, [B, C]]> {
		return new FuncCodec(
			([[a, b], c]) => [a, [b, c]],
			([a, [b, c]]) => [[a, b], c],
		)
	}

	public assocl<A, B, C>(): FuncCodec<[A, [B, C]], [[A, B], C]> {
		return this.flip(this.assocr())
	}

	public nil<A, B>(): Codec<B, [A[], B]> {
		return new FuncCodec(
			(b: B): [A[], B] => [[], b],
			([empty, b]) => empty.length === 0 ? b : undefined,
		)
	}

	public cons<A, B>(): FuncCodec<[[A, A[]], B], [A[], B]> {
		return new FuncCodec(
			([[a, as], b]) => [[a, ...as], b],
			([[a, ...as], b]) => [[a, as], b],
		)
	}

	public str(start: string): FuncCodec<string, string> {
		return new FuncCodec(
			(text) => text.startsWith(start) ? text.slice(start.length) : undefined,
			(text) => start + text,
		)
	}

	public regexp(r: RegExp): FuncCodec<string, [string, string]> {
		return new FuncCodec(
			(s) => {
				const match = r.exec(s)
				return match === null ? undefined : [match[0], s.slice(match[0].length)]
			},
			([match, rest]) => match + rest,
		)
	}

	public parens<A>(parens: [string, string][], codec: FuncCodec<string, [A, string]>): FuncCodec<string, [[string, A, string], string]> {
		return new FuncCodec(
			(s: string): [[string, A, string], string] | undefined => {
				for (const [open, close] of parens) {
					if (!s.startsWith(open)) {
						continue
					}

					const a = codec.forward(s.slice(open.length))
					if (a === undefined) {
						continue
					}

					const [a2, rest] = a
					if (!rest.startsWith(close)) {
						continue
					}

					return [[open, a2, close], rest.slice(close.length)]
				}

				return undefined
			},
			([[open, a, close], rest]) => {
				const result = codec.backward([a, close + rest])
				if (result === undefined) {
					return undefined
				}

				return open + result
			}
		)
	}

	// Environment mapping variable names to their values
	public readonly env: Map<string, FuncCodec<any, any>> = new Map()

	public var<A, B>(name: string): FuncCodec<A, B> {
		return new FuncCodec(
			(a: A): B | undefined => {	
				const codec = this.env.get(name)
				if (codec === undefined) {
					return undefined
				}

				return codec.forward(a)
			},
			(b: B): A | undefined => {
				const codec = this.env.get(name)
				if (codec === undefined) {
					return undefined
				}

				return codec.backward(b)
			},
		)
	}

	public define<A, B>(name: string, codec: FuncCodec<A, B>): void {
		this.env.set(name, codec)
	}
}

export type Document = Segment[]
export type Segment = [0, Text] | [1, Command]
export type Text = string
export type Command = [string, ...Arg[]]
export type Arg = [string, ArgBody, string]
export type ArgBody = ([0, Text] | [1, Command] | [2, Arg])[]

export type DocumentParserOptions = {
	command: string
	comment: string
	parens: [string, string][]
}

export class DocumentParser {
	public constructor(
		public readonly options: DocumentParserOptions = {
			command: '@',
			comment: ';',
			parens: [['(', ')'], ['{', '}'], ['[', ']']],
		},
	) {}

	public text(p: Parser): Codec<string, [Document, string]> {
		const text = p.regexp(/^[^@]+/)
		const symbol = p.regexp(/^[a-zA-Z0-9_]*/)
		const argText = p.regexp(/^[^@({\[\]})]+/)

		const argBody = p.star(p.seq(p.altn(argText, p.var<string, [Command, string]>('command'), p.var<string, [Arg, string]>('arg')), p.assocl()))

		const arg = p.parens(this.options.parens, argBody)
		p.define('arg', arg)
		
		const commandBody = p.seq(p.seq(p.seq(symbol, p.snd(p.star(p.var<string, [Arg, string]>('arg')))), p.assocl()), p.cons())
		const command = p.seq(p.str(this.options.command), commandBody)
		p.define('command', command)

		const document: Codec<string, [Document, string]> = p.star(p.seq(p.altn(text, command), p.assocl()))
		
		return document
	}
}

describe('DocumentParser', () => {
	it('parses a plain text document', () => {
		const parser = new ParserEval()
		const documentParser = new DocumentParser()
		const textDocumentParser = documentParser.text(parser) as FuncCodec<string, Document>
		const document = 'Hello, world!'
		const result = textDocumentParser.forward(document)
		const parsed: Document = [
			[0, 'Hello, world!']
		]
		expect(result).toEqual([parsed, ''])
	})

	it('parses a document with a command', () => {
		const parser = new ParserEval()
		const documentParser = new DocumentParser()
		const textDocumentParser = documentParser.text(parser) as FuncCodec<string, Document>
		const document = '@command'
		const result = textDocumentParser.forward(document)
		const parsed: Document = [
			[1, ['command']]
		]
		expect(result).toEqual([parsed, ''])
	})

	it('parses a document with a command and an argument', () => {
		const parser = new ParserEval()
		const documentParser = new DocumentParser()
		const textDocumentParser = documentParser.text(parser) as FuncCodec<string, Document>
		const document = '@command(arg)'
		const result = textDocumentParser.forward(document)
		const parsed: Document = [
			[1, ['command', ['(', [[0, 'arg']], ')']]]
		]
		expect(result).toEqual([parsed, ''])
	})

	it('parses a document with a command and an argument with a command', () => {
		const parser = new ParserEval()
		const documentParser = new DocumentParser()
		const textDocumentParser = documentParser.text(parser) as FuncCodec<string, Document>
		const document = '@command(arg@command)'
		const result = textDocumentParser.forward(document)
		const parsed: Document = [
			[1, ['command', ['(', [[0, 'arg'], [1, ['command']]], ')']]]
		]
		expect(result).toEqual([parsed, ''])
	})

	it('parses a document with a command and an argument with a command and an argument', () => {
		const parser = new ParserEval()
		const documentParser = new DocumentParser()
		const textDocumentParser = documentParser.text(parser) as FuncCodec<string, Document>
		const document = '@command(arg@command(arg))'
		const result = textDocumentParser.forward(document)
		const parsed: Document = [
			[1, ['command', ['(', [[0, 'arg'], [1, ['command', ['(', [[0, 'arg']], ')']]]], ')']]]
		]
		expect(result).toEqual([parsed, ''])
	})
})
