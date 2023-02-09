export type Symbol = string
export type Text = string
export type Arg = [number, string]
export type Command = [Symbol, Arg[]]
export type Document = [boolean, Command | Text][]

export type ParserOptions = {
	command: string
	comment: string
	spaces: string[]
	newlines: string[]
	parens: [string, string][]
}

export type TextCursor = {
	text: string
	index: number
}

export interface ICodec<A, B> {}

export interface ICodecFactory {
	alt<A, B>(...alts: ICodec<A, B>[]): ICodec<A, B>
}


export class EvalCodec<A, B> implements ICodec<A, B> {
	public constructor(
		public readonly encode: (a: A) => B,
		public readonly decode: (b: B) => A,
	) {}
}

export class EvalCodecRef<A, B> {
	public constructor(
		public readonly factory: ICodecFactory,
		public readonly codec: EvalCodec<A, B>,
	) {}
}

export class CodecFactory implements ICodecFactory {
	public seq<A, B, C>(f: EvalCodec<A, B>, g: EvalCodec<B, C>): EvalCodec<A, C> {
		return new EvalCodec(
			(a) => g.encode(f.encode(a)),
			(c) => f.decode(g.decode(c)),
		)
	}

	public flip<A, B>(codec: EvalCodec<A, B>): EvalCodec<B, A> {
		return new EvalCodec(codec.decode, codec.encode)
	}

	public alt<A, B, C, D>(left: EvalCodec<A, [B, D]>, right: EvalCodec<A, [C, D]>): EvalCodec<A, [[boolean, B | C], D]> {
		return new EvalCodec(
			(a): [[boolean, B | C], D] => {
				try {
					const [b, d] = left.encode(a)
					return [[true, b], d]
				} catch {
					const [c, d] = right.encode(a)
					return [[false, c], d]
				}
			},
			([[isLeft, bOrC], d]) => (isLeft ? left : right).decode([bOrC as B & C, d]),
		)
	}

	public altn<A, B>(...alts: EvalCodec<A, B>[]): EvalCodec<A, [number, B]> {
		return new EvalCodec(
			(a) => {
				for (let i = 0; i < alts.length; i++) {
					try {
						return [i, alts[i].encode(a)]
					} catch {}
				}

				throw new Error('No match')
			},
			([i, b]) => alts[i].decode(b),
		)
	}

	// TODO: Semigroup instead of string
	public repeat<B>(codec: EvalCodec<string, [B, string]>): EvalCodec<string, [B[], string]> {
		return new EvalCodec(
			(a) => {
				const bs: B[] = []
				while (true) {
					try {
						const [value, newA] = codec.encode(a)
						if (newA === a) {
							return [bs, a]
						}

						bs.push(value)
						a = newA
					} catch {
						return [bs, a]
					}
				}
			},
			([bs, a]) => bs.reverse().reduce((a, b) => codec.decode([b, a]), a),
		)
	}

	// FIXME: Semigroup and equality
	public readUntilAny(until: string[]): EvalCodec<string, [string, string]> {
		return new EvalCodec(
			(a) => {
				const index = until.reduce((index, u) => {
					const i = a.indexOf(u)
					return i === -1 ? index : i < index ? i : index
				}, a.length)

				return [a.slice(0, index), a.slice(index)]
			},
			([a, b]) => a + b,
		)
	}

	// FIXME: Make this a general equality check on the prefix of a semigroup
	public constText(text: string): EvalCodec<string, string> {
		return new EvalCodec(
			(a) => {
				if (a.startsWith(text)) {
					return a.slice(text.length)
				}

				throw new Error('No match')
			},
			(a) => text + a,
		)
	}

	// FIXME: Internalise the predicate
	public checkText(pred: (text: string) => boolean): EvalCodec<string, string> {
		return new EvalCodec(
			(a) => {
				if (pred(a)) {
					return a
				}

				throw new Error('No match')
			},
			(a) => a,
		)
	}

	// FIXME: Use an internal type for this instead of { length: number }
	public checkLength<T extends { length: number }>(pred: (length: number) => boolean): EvalCodec<T, T> {
		return new EvalCodec(
			(a) => {
				if (pred(a.length)) {
					return a
				}

				throw new Error('No match')
			},
			(a) => a,
		)
	}

	public pair<A, B, C>(): EvalCodec<[A, [B, C]], [[A, B], C]> {
		return new EvalCodec(
			([a, [b, c]]) => [[a, b], c],
			([[a, b], c]) => [a, [b, c]],
		)
	}

	// TODO: All internal, this should be a function
	public surround<A>(parens: [string, string][], codec: EvalCodec<string, [A, string]>): EvalCodec<string, [[number, A], string]> {
		const terms = parens.map(([open, close]) => this.seq(this.constText(open), this.seq(codec, this.snd(this.constText(close)))))
		return this.seq(this.altn(...terms), this.pair())
	}

	public fst<A, B, C>(codec: EvalCodec<A, B>): EvalCodec<[A, C], [B, C]> {
		return new EvalCodec(
			([a, c]) => [codec.encode(a), c],
			([b, c]) => [codec.decode(b), c],
		)
	}

	public snd<A, B, C>(codec: EvalCodec<A, B>): EvalCodec<[C, A], [C, B]> {
		return new EvalCodec(
			([c, a]) => [c, codec.encode(a)],
			([c, b]) => [c, codec.decode(b)],
		)
	}
}

export class DocumentParser2 {
	public constructor(
		public readonly options: ParserOptions = {
			command: '@',
			comment: ';',
			spaces: [' ', '\t'],
			newlines: ['\r', '\n'],
			parens: [['(', ')'], ['[', ']'], ['{', '}']],
		},
	) {}

	public textDoc(f: CodecFactory): EvalCodec<Text, [Document, Text]> {
		const argBody = f.readUntilAny([this.options.command, ...this.options.parens.flat()])
		const arg = f.surround(this.options.parens, argBody)

		const symbol = f.readUntilAny([this.options.command, this.options.comment, ...this.options.newlines, ...this.options.spaces, ...this.options.parens.flat()])
		const command = f.seq(f.constText(this.options.command), f.seq(f.seq(symbol, f.snd(f.repeat(arg))), f.pair()))

		const text = f.readUntilAny([this.options.command])
		
		const segment = f.alt(command, text)
		const document = f.repeat(segment)

		return document
	}
}

describe('Document parser', () => {
	it('Can parse a blank document', () => {
		const parser = new DocumentParser2()
		const textParser = parser.textDoc(new CodecFactory())
		const doc = textParser.encode('')
		expect(doc).toEqual([[], ''])
	})

	it('Can parse a document with normal text', () => {
		const parser = new DocumentParser2()
		const textParser = parser.textDoc(new CodecFactory())
		const doc = textParser.encode('Hello world!')
		expect(doc).toEqual([[[false, 'Hello world!']], ''])
	})

	it('Can print a document with normal text', () => {
		const parser = new DocumentParser2()
		const textParser = parser.textDoc(new CodecFactory())
		const text = textParser.decode([[[false, 'Hello world!']], ''])
		expect(text).toEqual('Hello world!')
	})

	it('Can parse a document with a command', () => {
		const parser = new DocumentParser2()
		const textParser = parser.textDoc(new CodecFactory())
		const doc = textParser.encode('@command')
		expect(doc).toEqual([[[true, ['command', []]]], ''])
	})

	it('Can parse a document with text and a command', () => {
		const parser = new DocumentParser2()
		const textParser = parser.textDoc(new CodecFactory())
		const doc = textParser.encode('Hello @command')
		expect(doc).toEqual([[[false, 'Hello '], [true, ['command', []]]], ''])
	})

	it('Can parse a document with a command and text', () => {
		const parser = new DocumentParser2()
		const textParser = parser.textDoc(new CodecFactory())
		const doc = textParser.encode('@command Hello')
		expect(doc).toEqual([[[true, ['command', []]], [false, ' Hello']], ''])
	})

	it('Can parse a document with a command and a command', () => {
		const parser = new DocumentParser2()
		const textParser = parser.textDoc(new CodecFactory())
		const doc = textParser.encode('@command1@command2')
		expect(doc).toEqual([[[true, ['command1', []]], [true, ['command2', []]]], ''])
	})

	it('Can parse arguments', () => {
		const parser = new DocumentParser2()
		const textParser = parser.textDoc(new CodecFactory())
		const doc = textParser.encode('@command(arg1)')
		expect(doc).toEqual([[[true, ['command', [[0, 'arg1']]]]], ''])
	})

	it('Can parse arguments with spaces', () => {
		const parser = new DocumentParser2()
		const textParser = parser.textDoc(new CodecFactory())
		const doc = textParser.encode('@command( arg1 )')
		expect(doc).toEqual([[[true, ['command', [[0, ' arg1 ']]]]], ''])
	})
})
