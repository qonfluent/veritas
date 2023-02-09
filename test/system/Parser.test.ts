export type Symbol = string
export type Text = string
export type Body = Text | Command | Arg
export type Arg = [string, Body[], string]
export type Command = [Symbol, ...Arg[]]
export type Document = (Command | Text)[]

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

export class DocumentParser {
	public constructor(
		public readonly options: ParserOptions = {
			command: '@',
			comment: ';',
			spaces: [' ', '\t'],
			newlines: ['\r', '\n'],
			parens: [['(', ')'], ['[', ']'], ['{', '}']],
		},
	) {}

	// Document = (Command / Text)*
	public textDoc(cursor: TextCursor): Document {
		const doc: Document = []
		while (cursor.index < cursor.text.length) {
			const comment = this.textComment(cursor)
			if (comment) {
				doc.push(comment)
				continue
			}
			
			const command = this.textCommand(cursor)
			if (command) {
				doc.push(command)
				continue
			}

			const text = this.textText(cursor)
			if (text) {
				doc.push(text)
				continue
			}

			break
		}

		return doc
	}

	// Text = [^@]+
	public textText(cursor: TextCursor): Text | undefined {
		const index = cursor.text.indexOf(this.options.command, cursor.index)
		if (index === -1) {
			const text = cursor.text.slice(cursor.index)
			cursor.index = cursor.text.length
			return text
		}

		const text = cursor.text.slice(cursor.index, index)
		cursor.index = index
		return text
	}

	// Comment = '@;' ![({[] [^\n\r]*
	public textComment(cursor: TextCursor): Command | undefined {
		// Check if it is a comment
		if (!cursor.text.startsWith(this.options.command + this.options.comment, cursor.index)) {
			return undefined
		}

		// Check if it is a single line comment
		if (this.options.parens.some(([open]) => cursor.text.startsWith(open, cursor.index))) {
			return undefined
		}

		// Skip the comment tag
		cursor.index += this.options.command.length + this.options.comment.length

		// Find the end of the comment
		const index = Math.min(cursor.text.length, ...this.options.newlines.map((newline) => cursor.text.indexOf(newline, cursor.index)).filter((index) => index !== -1))

		// Create the comment
		const comment = cursor.text.slice(cursor.index, index)
		cursor.index = index

		return [this.options.comment, ['', [comment], '']]
	}

	// Command = '@' s:Symbol? a:Arg* ![({[]
	public textCommand(cursor: TextCursor): Command | undefined {
		const start = cursor.index

		// Read command tag
		if (!cursor.text.startsWith(this.options.command, cursor.index)) {
			return undefined
		}

		cursor.index += this.options.command.length

		// Read symbol
		const symbol = this.textSymbol(cursor)

		// Read args
		const args: Arg[] = []
		while (cursor.index < cursor.text.length) {
			const arg = this.textArg(cursor)
			if (arg) {
				args.push(arg)
				continue
			}

			break
		}

		// Make sure the command is not followed by an open paren
		// NOTE: This is to prevent strange behavior when a command is followed by unbalanced parens
		if (this.options.parens.some(([open]) => cursor.text.startsWith(open, cursor.index))) {
			cursor.index = start
			return undefined
		}

		return [symbol, ...args]
	}

	// Symbol = [^@ \t\n\r(){}\[\]]+
	public textSymbol(cursor: TextCursor): Symbol {
		const start = cursor.index
		const stops = [this.options.command, ...this.options.spaces, ...this.options.newlines, ...this.options.parens.flat()]
		const stopIndex = Math.min(cursor.text.length, ...stops.map((stop) => cursor.text.indexOf(stop, cursor.index)).filter((index) => index !== -1))
		const symbol = cursor.text.slice(cursor.index, stopIndex)
		cursor.index = stopIndex
		return symbol
	}

	// Arg = &[({[] '(' Body ')' / '[' Body ']' / '{' Body '}'
	public textArg(cursor: TextCursor): Arg | undefined {
		const start = cursor.index

		if (!this.options.parens.some(([open]) => cursor.text.startsWith(open, cursor.index))) {
			return undefined
		}

		for (const [open, close] of this.options.parens) {
			// Read open paren
			if (!cursor.text.startsWith(open, cursor.index)) {
				continue
			}

			cursor.index += open.length

			// Read body
			const body = this.textBody(cursor)

			// Read close paren
			if (!cursor.text.startsWith(close, cursor.index)) {
				cursor.index = start
				continue
			}

			cursor.index += close.length

			return [open, body, close]
		}

		return undefined
	}

	// Body = body:($[^@(){}\[\]]+ / Command / Arg)*
	public textBody(cursor: TextCursor): Body[] {
		const body: Body[] = []
		while (cursor.index < cursor.text.length) {
			const text = this.textBodyText(cursor)
			if (text) {
				body.push(text)
				continue
			}

			const command = this.textCommand(cursor)
			if (command) {
				body.push(command)
				continue
			}

			const arg = this.textArg(cursor)
			if (arg) {
				body.push()
				continue
			}

			break
		}

		return body
	}

	// Text = [^@(){}\[\]]+
	public textBodyText(cursor: TextCursor): Text | undefined {
		const stops = [this.options.command, ...this.options.parens.flat()]
		const stopIndex = Math.min(cursor.text.length, ...stops.map((stop) => cursor.text.indexOf(stop, cursor.index)).filter((index) => index !== -1))
		if (stopIndex === cursor.index) {
			return undefined
		}
		const text = cursor.text.slice(cursor.index, stopIndex)
		cursor.index = stopIndex
		return text
	}
}

describe('Reference parser', () => {
	it('Can parse an empty document', () => {
		const parser = new DocumentParser()
		const doc = parser.textDoc({ text: '', index: 0 })
		expect(doc).toEqual([])
	})

	it('Can parse a document with a single command', () => {
		const parser = new DocumentParser()
		const doc = parser.textDoc({ text: '@foo', index: 0 })
		expect(doc).toEqual([['foo']])
	})

	it('Can parse a document with a single command and a single arg', () => {
		const parser = new DocumentParser()
		const doc = parser.textDoc({ text: '@foo(bar)', index: 0 })
		expect(doc).toEqual([['foo', ['(', ['bar'], ')']]])
	})

	it('Can parse a document with a single command and a single arg with text before', () => {
		const parser = new DocumentParser()
		const doc = parser.textDoc({ text: 'hello @foo(bar)', index: 0 })
		expect(doc).toEqual(['hello ', ['foo', ['(', ['bar'], ')']]])
	})

	it('Can parse a document with a single command and a single arg with text after', () => {
		const parser = new DocumentParser()
		const doc = parser.textDoc({ text: '@foo(bar) hello', index: 0 })
		expect(doc).toEqual([['foo', ['(', ['bar'], ')']], ' hello'])
	})

	it('Can parse a document with a single command and a single arg with text before and after', () => {
		const parser = new DocumentParser()
		const doc = parser.textDoc({ text: 'hello @foo(bar) goodbye', index: 0 })
		expect(doc).toEqual(['hello ', ['foo', ['(', ['bar'], ')']], ' goodbye'])
	})

	it('Can parse a comment', () => {
		const parser = new DocumentParser()
		const doc = parser.textDoc({ text: '@; comment\nnormal text', index: 0 })
		expect(doc).toEqual([[';', ['', [' comment'], '']], '\nnormal text'])
	})

	it('Can parse multiline content', () => {
		const parser = new DocumentParser()
		const doc = parser.textDoc({ text: '@uwu(@foo(bar)\n@foo(bar))', index: 0 })
		expect(doc).toEqual([['uwu', ['(', [['foo', ['(', ['bar'], ')']], '\n', ['foo', ['(', ['bar'], ')']]], ')']]])
	})

	it('Can parse multiple args', () => {
		const parser = new DocumentParser()
		const doc = parser.textDoc({ text: '@foo(bar)(baz)', index: 0 })
		expect(doc).toEqual([['foo', ['(', ['bar'], ')'], ['(', ['baz'], ')']]])
	})

	it('Can parse multiple commands', () => {
		const parser = new DocumentParser()
		const doc = parser.textDoc({ text: '@foo(bar)@baz(baz)', index: 0 })
		expect(doc).toEqual([['foo', ['(', ['bar'], ')']], ['baz', ['(', ['baz'], ')']]])
	})
})
