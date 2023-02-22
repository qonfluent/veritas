// --- VALUES ---
export type Name = string

export type Value
	= { tag: 'VUnit' }
	| { tag: 'VString', value: string }
	| { tag: 'VNumber', value: number }
	| { tag: 'VBoolean', value: boolean }
	| { tag: 'VSeq', value: Value[] }

// --- PATTERNS ---
export type Pattern
	= { tag: 'PAny' }
	| { tag: 'PNone' }
	| { tag: 'PValue', value: Value }
	| { tag: 'PBind', name: Name, pattern: Pattern }
	| { tag: 'PCall', name: Name, args: (Name | PatternFunc)[] }
	| { tag: 'PThen', patterns: Pattern[] }
	| { tag: 'PAlt', patterns: Pattern[] }
	| { tag: 'PStr', value: string }
	| { tag: 'PRegex', value: RegExp }
	| { tag: 'PRepeat', pattern: Pattern, min: number, max?: number }
	| { tag: 'PSeq', patterns: Pattern[] }

export type PatternFunc = { args: Name[], body: Pattern }

export type Language = Record<Name, PatternFunc>
