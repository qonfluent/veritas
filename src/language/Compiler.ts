import { Name, Value, Language, PatternFunc, Pattern } from "./AST"
import { compileAny, compileNone, compileValue, compileBind, compileCall, compileThen, compileAlt } from "./operations/Common"
import { compileSeq, compileRepeat } from "./operations/Seq"
import { compileStr, compileRegex } from "./operations/String"

// --- CODECS ---
export type CodecState = {
	env: Record<Name, Value>,
	value: Value
}
export type CodecFunc = (...args: CodecFunc[]) => {
	forward: (state: CodecState, cb: (state: CodecState | undefined) => void) => void
	backward: (state: CodecState, cb: (state: CodecState | undefined) => void) => void
}
export type CodecFuncGroup = Record<Name, CodecFunc>

// --- COMPILER ---
export function compileLanguage(language: Language): CodecFuncGroup {
	const env: CodecFuncGroup = {}
	for (const name in language) {
		env[name] = compilePatternFunc(language[name], name, env)
	}
	return env
}

export function compilePatternFunc(patternFunc: PatternFunc, name: Name, env: CodecFuncGroup): CodecFunc {
	const body = compilePattern(patternFunc.body, env)
	return (...args: CodecFunc[]) => {
		if (args.length !== patternFunc.args.length) {
			throw new Error(`Invalid number of arguments for pattern function ${name}`)
		}

		return body(...args)
	}
}

export function compilePattern(pattern: Pattern, env: CodecFuncGroup): CodecFunc {
	switch (pattern.tag) {
		case 'PAny': return compileAny()
		case 'PNone': return compileNone()
		case 'PValue': return compileValue(pattern.value)
		case 'PBind': return compileBind(pattern.name, pattern.pattern, env)
		case 'PCall': return compileCall(pattern.name, pattern.args, env)
		case 'PThen': return compileThen(pattern.patterns, env)
		case 'PAlt': return compileAlt(pattern.patterns, env)
		case 'PStr': return compileStr(pattern.value)
		case 'PRegex': return compileRegex(pattern.value)
		case 'PSeq': return compileSeq(pattern.patterns, env)
		case 'PRepeat': return compileRepeat(pattern.pattern, pattern.min, pattern.max, env)
	}
}
