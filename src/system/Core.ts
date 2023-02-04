export enum Tag {
	Text,
	Command,
	Seq,
}

export class Value {
	public constructor(
		public readonly tag: Tag,
	) {}
}

export class TextValue extends Value {
	public constructor(
		public readonly text: string,
	) {
		super(Tag.Text)
	}
}

export class Paren {
	public constructor(
		public readonly open: string,
		public readonly value: Value,
		public readonly close: string,
	) {}
}

export class CommandValue extends Value {
	public constructor(
		public readonly command: string | Paren,
		public readonly args: Paren[],
	) {
		super(Tag.Command)
	}
}

export class SeqValue extends Value {
	public constructor(
		public readonly values: (TextValue | CommandValue)[],
	) {
		super(Tag.Seq)
	}
}

export type Cursor = {
	text: string
	index: number
}

export class TextParser {
	public constructor(
		public readonly commandSymbol: string,
		public readonly spaces: string[],
		public readonly seperators: string[],
		public readonly parens: [string, string, Tag][],
	) {}

	public parse(text: string): Value {
		// Create a cursor to track our position in the text
		const cursor = { text, index: 0 }

		// Parse the text
		const result: (TextValue | CommandValue)[] = []
		while (cursor.index < cursor.text.length) {
			// Parse a text value stopping on the command symbol
			const preText = this.parseUntil(cursor, [this.commandSymbol])
			if (preText.length > 0) {
				result.push(new TextValue(preText))
			}

			// Parse a command
			if (cursor.index < cursor.text.length) {
				if (cursor.text.startsWith(this.commandSymbol, cursor.index)) {
					cursor.index += this.commandSymbol.length
					result.push(this.parseCommand(cursor))
				}
			}
		}

		if (result.length === 1) {
			return result[0]
		}

		return new SeqValue(result)
	}

	private parseCommand(cursor: Cursor): CommandValue {
		// Check for a paren
		let command: Paren | string | undefined = this.parseParen(cursor)
		if (command === undefined) {
			// Parse a symbol
			command = this.parseUntil(cursor, this.spaces.concat(this.parens.flatMap(p => [p[0], p[1]])))
		}

		// Parse the arguments
		const args: Paren[] = []
		while (cursor.index < cursor.text.length) {
			// Parse next argument
			const arg = this.parseParen(cursor)
			if (arg === undefined) {
				break
			}
			args.push(arg)
		}

		return new CommandValue(command, args)
	}

	private parseParen(cursor: Cursor): Paren | undefined {
		// Check for a paren
		// NOTE: This requires that the parens be sorted by length from longest to shortest
		const paren = this.parens.find(p => cursor.text.startsWith(p[0], cursor.index))
		if (paren === undefined) {
			return undefined
		}

		// Parse the paren
		cursor.index += paren[0].length
		const text = this.parseUntilBalanced(cursor, paren[1])

		switch (paren[2]) {
			case Tag.Text: {
				return new Paren(paren[0], new TextValue(text), paren[1])
			}
			case Tag.Command:
			case Tag.Seq: {
				return new Paren(paren[0], this.parse(text), paren[1])
			}
		}
	}

	private findNext(cursor: Cursor, stop: string[]): number {
		return stop.reduce((min, stop) => {
			const index = cursor.text.indexOf(stop, cursor.index)
			return index < min ? index : min
		}, cursor.text.length)
	}

	private parseUntil(cursor: Cursor, stop: string[]): string {
		const stopIndex = this.findNext(cursor, stop)
		if (stopIndex !== -1) {
			const text = cursor.text.substring(cursor.index, stopIndex)
			cursor.index = stopIndex
			return text
		}

		const text = cursor.text.substring(cursor.index)
		cursor.index = cursor.text.length
		return text
	}

	private parseUntilBalanced(cursor: Cursor, stop: string): string {
		const startParens = this.parens.map(p => p[0])
		const endParens = this.parens.map(p => p[1])

		const stack = [stop]
		const startIndex = cursor.index
		while (cursor.index < cursor.text.length && stack.length > 0) {
			// Look for the next start
			const startIndex = this.findNext(cursor, startParens)
			if (startIndex < cursor.index) {
				// Found a start
				const paren = this.parens.find(p => cursor.text.startsWith(p[0], startIndex))
				if (paren === undefined) {
					throw new Error('Invalid state')
				}

				// Push the end onto the stack
				stack.push(paren[1])
				cursor.index = startIndex + paren[0].length
			}

			// Look for the next end
			const endIndex = this.findNext(cursor, stack)
			if (endIndex < cursor.index) {
				// Found an end
				stack.pop()
				cursor.index = endIndex + stack[stack.length - 1].length
			}
		}

		return cursor.text.substring(startIndex, cursor.index)
	}
}
