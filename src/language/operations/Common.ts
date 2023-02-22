import { Value, Name, Pattern, PatternFunc } from "../AST"
import { CodecFunc, CodecFuncGroup, CodecState, compilePattern, compilePatternFunc } from "../Compiler"

export function compileAny(): CodecFunc {
	return () => ({
		forward: (state, cb) => cb(state),
		backward: (state, cb) => cb(state)
	})
}

export function compileNone(): CodecFunc {
	return () => ({
		forward: (_, cb) => cb(undefined),
		backward: (_, cb) => cb(undefined)
	})
}

export function compileValue(value: Value): CodecFunc {
	return () => ({
		forward: (state, cb) => {
			switch (state.value.tag) {
				case 'VUnit': return cb(value.tag === 'VUnit' ? { ...state, value: { tag: 'VUnit' } } : undefined)
				case 'VString': return cb(value.tag === 'VString' && value.value === state.value.value ? { ...state, value: { tag: 'VUnit' } } : undefined)
			}
		},
		backward: (state, cb) => cb({ ...state, value })
	})
}

export function compileBind(name: Name, pattern: Pattern, env: CodecFuncGroup): CodecFunc {
	const compiledPattern = compilePattern(pattern, env)
	return () => ({
		forward: (state, cb) => {
			compiledPattern().forward(state, (newState) => {
				if (newState === undefined) return cb(undefined)
				cb({ ...newState, env: { ...newState.env, [name]: newState.value } })
			})
		},
		backward: (state, cb) => {
			if (state.env[name] === undefined) return cb(undefined)
			compiledPattern().backward({ ...state, value: state.env[name] }, cb)
		},
	})
}

export function compileCall(name: Name, args: (Name | PatternFunc)[], env: CodecFuncGroup): CodecFunc {
	const func = env[name]
	if (func === undefined) {
		throw new Error(`Unknown pattern function ${name}`)
	}

	const compiledArgs = args.map((arg) => typeof arg === 'string' ? env[arg] : compilePatternFunc(arg, name, env))

	return (...args: CodecFunc[]) => ({
		forward: (state, cb) => {
			if (args.length !== compiledArgs.length) {
				throw new Error(`Invalid number of arguments for pattern function ${name}`)
			}

			func(...args).forward(state, cb)
		},
		backward: (state, cb) => {
			if (args.length !== compiledArgs.length) {
				throw new Error(`Invalid number of arguments for pattern function ${name}`)
			}

			func(...args).backward(state, cb)
		},
	})
}

export function compileThen(patterns: Pattern[], env: CodecFuncGroup): CodecFunc {
	const compiledPatterns = patterns.map((pattern) => compilePattern(pattern, env))
	return (...args: CodecFunc[]) => ({
		forward: (state, cb) => {
			for (const compiledPattern of compiledPatterns) {
				compiledPattern(...args).forward(state, (newState) => {
					if (newState === undefined) return cb(undefined)
					state = newState
				})
			}

			cb(state)
		},
		backward: (state, cb) => {
			for (const compiledPattern of compiledPatterns.slice().reverse()) {
				compiledPattern(...args).backward(state, (newState) => {
					if (newState === undefined) return cb(undefined)
					state = newState
				})
			}

			cb(state)
		},
	})
}

export function compileAlt(patterns: Pattern[], env: CodecFuncGroup): CodecFunc {
	const compiledPatterns = patterns.map((pattern) => compilePattern(pattern, env))

	return (...args: CodecFunc[]) => ({
		forward: (state, cb) => {
			for (const compiledPattern of compiledPatterns) {
				let newState: CodecState | undefined
				compiledPattern(...args).forward(state, (state) => newState = state)
				if (newState !== undefined) return cb(newState)
			}

			cb(undefined)
		},
		backward: (state, cb) => {
			for (const compiledPattern of compiledPatterns) {
				compiledPattern(...args).backward(state, (newState) => {
					if (newState !== undefined) return cb(newState)
				})
			}

			cb(undefined)
		},
	})
}
