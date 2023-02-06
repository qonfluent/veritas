import { ArgNode, CommandNode, SyntaxNode, TextNode, Document } from './AST'
import { TextCursor } from './Cursor'

export type ParserOptions = {
	readonly command: string
	readonly comment: string
	readonly spaces: string[]
	readonly newlines: string[]
	readonly parens: [string, string][]
}

export interface SyntaxParser {
	parse(cursor: TextCursor): SyntaxNode | undefined
}

export class DocumentParser implements SyntaxParser {
	public constructor(
		public readonly opts: ParserOptions,
	) {}

	public parse(cursor: TextCursor, stops: string[] = []): Document | undefined {
		// Create helper parsers
		const commandParser = new CommandParser(this.opts)
		const textParser = new TextParser(this.opts)

		// Loop over the document, parsing each node.
		const result: (TextNode | CommandNode)[] = []
		while (!cursor.done) {
			// Check if we've reached a stop
			const stop = cursor.findNext(stops)
			if (stop && stop[0] === cursor.index) {
				cursor.reset(stop[0])
				break
			}

			// First look for a command
			const command = commandParser.parse(cursor, stops)
			if (command) {
				result.push(command)
				continue
			}

			// Then look for text
			const text = textParser.parse(cursor, stops.concat(this.opts.command))
			if (text) {
				result.push(text)
				continue
			}

			// If it's not a command or text, then it's an error.
			throw new Error()
		}

		// Return the document
		return new Document(result)
	}
}

export class TextParser implements SyntaxParser {
	public constructor(
		public readonly opts: ParserOptions,
	) {}

	public parse(cursor: TextCursor, stops: string[] = []): TextNode | undefined {
		const result = cursor.parseUntil(stops)
		if (result) {
			return new TextNode(result)
		}

		return undefined
	}
}

export class CommandParser implements SyntaxParser {
	public constructor(
		public readonly opts: ParserOptions,
	) {}

	public parse(cursor: TextCursor, stops: string[] = []): CommandNode | undefined {
		// Check if it's a command
		if (!cursor.startsWith(this.opts.command, true)) {
			return undefined
		}

		// Check if it's a comment
		if (cursor.startsWith(this.opts.comment, true)) {
			const commentParser = new CommentParser(this.opts)
			return commentParser.parse(cursor, stops)
		}

		// Parse the command symbol, stop at command, comment, space, newline, or paren
		const symbolStops = [this.opts.command, this.opts.comment, ...this.opts.spaces, ...this.opts.newlines, ...this.opts.parens.flat()]
		const symbol = cursor.parseUntil(symbolStops)
		
		// Parse the command args
		const argParser = new ArgParser(this.opts)
		const args: ArgNode[] = []
		while (!cursor.done) {
			// Parse the arg
			const arg = argParser.parse(cursor, stops)
			if (arg) {
				args.push(arg)
				continue
			}

			break
		}

		// Return the command
		return new CommandNode(symbol, args)
	}
}

export class CommentParser implements SyntaxParser {
	public constructor(
		public readonly opts: ParserOptions,
	) {}

	public parse(cursor: TextCursor, stops: string[] = []): CommandNode | undefined {
		// Record the start position
		const start = cursor.index
		const documentParser = new DocumentParser(this.opts)

		// Check if it's a multi-line comment, i.e. if it starts with an open paren
		for (const [open, close] of this.opts.parens) {
			if (cursor.startsWith(open, true)) {
				// Parse the comment, stop at close paren
				const comment = documentParser.parse(cursor, stops.concat(close))
				if (!comment) {
					// If it doesn't parse, then reset to the start position
					cursor.reset(start)
					continue
				}

				// Check if it ends with the close paren
				if (!cursor.startsWith(close, true)) {
					// If it doesn't, then reset to the start position
					cursor.reset(start)
					continue
				}

				// Return the comment
				return new CommandNode(this.opts.comment, [new ArgNode(open, comment, close)])
			}
		}

		// Check if it starts with an open paren
		const index = cursor.findNext(this.opts.parens.map(([open]) => open))
		if (index && index[0] === cursor.index) {
			// Error
			throw new Error()
		}

		// It's a single-line comment, parse the comment, stop at newline
		const comment = documentParser.parse(cursor, this.opts.newlines.concat(stops))
		if (!comment) {
			// If it doesn't parse, then reset to the start position
			cursor.reset(start)
			return undefined
		}

		// Return the comment
		return new CommandNode(this.opts.comment, [new ArgNode('', comment, '')])
	}
}

export class ArgParser implements SyntaxParser {
	public constructor(
		public readonly opts: ParserOptions,
	) {}

	public parse(cursor: TextCursor, stops: string[] = []): ArgNode | undefined {
		// Create a document parser
		const documentParser = new DocumentParser(this.opts)

		// Record the start position
		const start = cursor.index

		// Try each pair of parens
		for (const [open, close] of this.opts.parens) {
			// Check if the cursor starts with the open paren
			if (!cursor.startsWith(open, true)) {
				continue
			}

			// Parse the arg body
			// FIXME: Use a set for stops
			const body = documentParser.parse(cursor, stops.concat(close))
			if (!body) {
				// If it doesn't parse, then reset to the start position
				cursor.reset(start)
				continue
			}

			// Check if the cursor starts with the close paren
			if (!cursor.startsWith(close, true)) {
				// If it doesn't, then reset to the start position
				cursor.reset(start)
				continue
			}

			// Return the arg
			return new ArgNode(open, body, close)
		}

		// No parens matched, it's not an arg
		return undefined
	}
}
