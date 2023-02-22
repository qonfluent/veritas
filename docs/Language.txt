
General idea
	- Comments and literate programming
		- Comments are first class values
		- Comments can be attached to any syntax element(symbols, functions, etc) with doc comments
		- Comments use at-code syntax, similar to TeX
		- Comments can be used to generate documentation
	- Import system with syntax sugar for modules and namespaces
		- Ability to load from local documents, remote documents, and builtins
		- Can rename imports and exports
		- Can import specific symbols
		- Can import all symbols
		- Can import all symbols except some
		- Can import all symbols from a specific scope
		- Can import all symbols from a specific scope except some
	- Strong type system with higher inductive types, records, and interfaces
		- Types are first class values
		- Types include modes, variance, nominal vs structural typing, effects, and other features
	- Representations of a type as other formats via isomorphism
		- All types have a default representation in text and bytes
		- Representations can be defined for any type
		- Representations can be selected for any type
	- Functions are attached to values, firing when the value is updated to process the change
		- Several kinds of change are possible
		  - Value created
			- Value moved
			- Value copied
			- Value child created
			- Value set
			- Value changed(delta depends on type, ex. append, increment, etc.)
			- Value deleted
		- Functions can be attached to any symbol or set of symbols, waiting for them to change
			- Attachment can be done by selection across the entire node / set of nodes
			- Attachment can be done by selection within a specific scope / set of scopes
			- Attachment can be done by selection within a specific type / set of types
			- Attachment can be done by selection within a specific value / set of values
			- Other attachment queries are possible
		- Effects control the set of symbols that may be attached to a function and in what ways
			- Console output requires the ability to write to the console symbol
				- Effect context records all accessed symbols for each function
				- Effect context can be used to check against the allowed effects for a function
		- Functions have a mode, allowing for inverses and other per-argument control
			- Each symbol used in the function can be marked with a mode
			- The modes are used to signal variance, directionality, and other properties
			- Examples(syntax TBD):
				- add(a: in Z, b: in Nat): out Nat = b
				- add(a: in (S k), b: in Nat): out Nat = add(k, S b)
				- add(a: out Nat, b: in Nat): r in Nat = r - b
				- add(a: in Nat, b: out Nat): r in Nat = r - a
	- Every change from a function is performed at some time: now, next, or eventually
		- Now: change is performed in the same time step(handling conflicts at compile time)
		- Next: change is performed in the next time step(handling conflicts at compile time)
		- Eventually: change is performed in the next time step, but conflicts are impossible
			- No conflicts because each eventually happens in a unique time step
	- Conflicts are resolved by the compiler using several strategies
		- Reject - reject the change on conflict
		- Merge - merge the changes on conflict(CRDTs)
		- Split - returns multiple results
	- Multiple results can be given by a function
		- This is OR concurrency
		- This is used for nondeterminism
	- Do notation and similar for specific monads
		- Do, IO, maybe, and either all deserve special syntax, maybe others too
		- Special syntax should be available at the user level, thus this should be in the library
	- Data lifetime and ownership information
		- Data may be created, copied, deleted, or moved between nodes
		- Or programs can move to a new node to be closer to the data(non-copyable data or expensive to copy data)
		- Data may be moved to a new node to be closer to the function(caching)
		- Large data structures may be split across many nodes transparently to the user
		- Persistant values are saved on disk, and can be loaded from disk
		- Persistant values can be queried from disk on demand with minimal overhead
		- Volatile values are not saved on disk, and are lost when the program exits
		- A lot of this will be library level, but the language should support it
	- Editor aware syntax
		- The language should be represented in such a way that various deltas can be applied to it in a type safe way

Imports and exports
	- `import` and `export` are used to import and export symbols or modules
	- `import` and `export` can be used to rename symbols or modules
	- Examples:
		- import * from 'local.machine' -- All symbol import
		- import { a, b, c } from 'local.machine' -- Symbol import
		- import { a: whatever } from 'local.machine' -- Import with rename
		- import { a: whatever.x } from 'local.machine' -- Import with rename and namespace
		- import * except { a, b, c } from 'local.machine' -- All symbol import except some
		- import machine from 'local.machine' -- Module import
		- export { a, b, c } -- Symbol export
		- export { a: whatever } -- Symbol export with rename
		- export { a: whatever.x } -- Symbol export with rename and namespace
		- export * -- All symbol export
		- export * except { a, b, c } -- All symbol export except some
		- export machine -- Module export

Line Comments, Literate Programming, and Doc Comments
	- Comments are split into four broad types
		- Line comments provide a single line of plain text commentary(no at-code)
			- Ex: @; This is a line comment
		- Multiline comments provide a block of at-code commentary
			- Ex: @;{Multiline comments are also supported}
		- Literate programming is provided by the document layer
		- Doc comments are multiline comments which are attached to a symbol or other syntax element
			- Ex: @doc{Doc comments are attached to a symbol or other syntax element which follows them}
			- Doc comments are provided by the document layer

Types
	- Types are first class values
	- Types can be nominal or structural
	- HITs are supported
	- Paths are supported
	- Records are supported
	- Sets/unions are supported
	- Subtyping is supported
	- Variance is supported
	- Effects are supported
	- Interfaces and instances are supported
	- Examples:
		- Nat, String, Bool, etc. -- Primitive type
		- List a, Map a b, etc. -- Higher order type
		- { a: Nat, b: String } -- Record type
		- Nat | String -- Union type
		- Nat -> String -- Pi type
		- (n: Nat, n ** 2) -- Sigma types
		- x = y -- Path types
		- left, right -- Path index types

Representations
	- Representations are first class values implemented as path types
	- Representations of a type as other formats via isomorphism
	- All types have a default representation in text and bytes
	- Representations can be defined for any type
	- Representations can be selected for any type via a type annotation

Functions
	- Functions are first class values
	- Functions have a type signature




Layer 1: The Programmable Parser
- The parser is a DSL for defining parsers. It has a few basic parsers, and a few combinators for combining parsers.
- A parser is a general function A -> B, where A is the input type and B is the output type.
- At the lowest level, parsers convert the bytes making up the code's source into a Value.
- Values are the basic building blocks of the language. They are the output of the parser, and the core of evaluation.
- Values are immutable, and are used to represent the state of the program.
- All Values have at least one Representation in terms of bytes and one in terms of strings.
- Parsers match the bytes making up the source code and convert them into Values of the appropriate type.

Layer 2: The Extensible Evaluation Engine
- Values are terms in the Core language. They are the output of the parser, and the core of evaluation.
- The core langauge provides a powerful type system capable of expressing the semantics of any language.
- Combined with the parser, the core language provides a powerful framework for defining languages.
- The core language provides a dependent type system with HITs and other advanced features, and a powerful type inference algorithm.
- The core language is extensible, and can be extended with new features and new syntax.
- The set of all languages and parsers is contined in the top level Document type.

Layer 3: The Document
- The Document is the top level type of the language. It is the entry point for the parser and the evaluator.
- The Document is a list of Segments. Each Segment is either a Text Segment or a Command Segment.
- Text Segments are the raw text of the document, and are not parsed or evaluated.
- Command Segments are parsed and evaluated, and are the core of the document level language.
- Commands are attached to various parsers for their various arguments.
- Each command is a variadic funciton, and the arguments are passed to the command as a list of Values.
	- Pattern matching and type checking are performed on the arguments to ensure that they are of the correct type and number
- The result of the command is a Value, which may be bound to a variable in the document.
	- A scope control language allows for import/export of variables between documents.
- The resulting document is rendered with the appropriate renderer for the output format as requested by the user.

Layer 4: The Renderer
- The renderer is a function that takes a Value and converts it into an output format.
- This is a codec from a Value back to a base type, such as a string or a byte array.
- The result of a renderer is sent to an implementation of the Output interface.






This is an example of defining a language and then using it. First, we define TestLang

@language[TestLang]{
	First we do some imports from core and set up a default export so this language can be used

	@import{
		import { Symbol, AtCode } from Core
		export default Expr
	}

	Here's a silly example syntax, showing some of the pattern matching operators:

	@syntax{
		@; We can have single line comments like this still
		Var = Symbol
		Expr =
			| Var
		  > '\\' Var _ '=>' _ e
			> Expr __ Expr
			| '(' Expr ')'
			| 'abort'
			| n:[0-9]+ => decimal n
			> AtCode

		_ = [ \t]*  {{drop}}
		__ = [ \t]+ {{drop}}
	}

	Some more syntax parts can be added. If a syntax symbol is defined more than once,
	the system will merge them into alt cases(i.e. insert | between the defs)

	From the syntax definition, we can automatically generate the following:

	@ul{
		@li{An ADT representing the syntax}
		@li{A parser from UTF-8 text to the ADT}
		@li{A printer that converts the ADT to text}
		@li{A decoder from a common binary format to the ADT}
		@li{An encoder from the ADT to a common binary format}
	}

	For a small cost of adding a few annotations and reduction operations you can get a very clean
	and easy to work with ADT from the parser

	Some semantics syntax goes here, probably quite similar to the reduction sytax above used on _ and __
	Conceptually these are an abstraction of sequent calculus.

	@semantics{}
	
	Some data needs special representations in formats other than the default text/binary
	These representations can be defined using these blocks. Here's an example of representing
	the ADT as an image. The representation 'image' defined below would generate an image output
	assuming the system supported a bitmap graphics mode of at least 1024x768.

	This syntax needs a bit of love, but the idea is to allow for representing the data in
	whatever format is the most convenient for that type, while also tagging the data at a
	high level with the metadata of the format, so different devices can automatically select
	the set of representations they can support. This is similar to capabilities/effects/protocols.

	@representation[name=image, require=graphics(bitmap(32bpp, x >= 1024px, y >= 768px))]{
		<Representations use the same syntax as "syntax", but start with the abstract type>
	}
}
