export interface SyntaxNode {}

export class Document implements SyntaxNode {
	public constructor(
		public readonly nodes: (TextNode | CommandNode | CommentNode)[],
	) {}
}

export class TextNode implements SyntaxNode {
	public constructor(
		public readonly text: string,
	) {}
}

export class CommandNode implements SyntaxNode {
	public constructor(
		public readonly command: string,
		public readonly args: ArgNode[],
	) {}
}

export class CommentNode implements SyntaxNode {
	public constructor(
		public readonly document: Document,
	) {}
}

export class ArgNode implements SyntaxNode {
	public constructor(
		public readonly open: string,
		public readonly document: Document,
		public readonly close: string,
	) {}
}
