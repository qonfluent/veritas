import { Pattern, Value } from "../AST"
import { CodecFuncGroup, CodecFunc, compilePattern, CodecState } from "../Compiler"
import { mergeEnvironments } from "./Utils"

export function compileSeq(patterns: Pattern[], env: CodecFuncGroup): CodecFunc {
	const compiledPatterns = patterns.map((pattern) => compilePattern(pattern, env))
	return (...args: CodecFunc[]) => ({
		forward: (state, cb) => {
			// Check seq matches
			if (state.value.tag !== 'VSeq') return cb(undefined)
			if (state.value.value.length !== compiledPatterns.length) return cb(undefined)

			// Run each pattern
			const result: CodecState[] = []
			for (let i = 0; i < compiledPatterns.length; i++) {
				compiledPatterns[i](...args).forward({ ...state, value: state.value.value[i] }, (newState) => {
					if (newState === undefined) return cb(undefined)
					result.push(newState)
				})
			}

			// Return result
			return cb({ env: mergeEnvironments(...result.map((state) => state.env)), value: { tag: 'VSeq', value: result.map((state) => state.value) } })
		},
		backward: (state, cb) => {
			// Check seq matches
			if (state.value.tag !== 'VSeq') return cb(undefined)
			if (state.value.value.length !== compiledPatterns.length) return cb(undefined)

			// Run each pattern
			const result: CodecState[] = []
			for (let i = 0; i < compiledPatterns.length; i++) {
				compiledPatterns[i](...args).backward({ ...state, value: state.value.value[i] }, (newState) => {
					if (newState === undefined) return cb(undefined)
					result.push(newState)
				})
			}

			// Return result
			return cb({ env: mergeEnvironments(...result.map((state) => state.env)), value: { tag: 'VSeq', value: result.map((state) => state.value) } })
		},
	})
}

export function compileRepeat(pattern: Pattern, min: number, max: number | undefined, env: CodecFuncGroup): CodecFunc {
	const compiledPattern = compilePattern(pattern, env)

	function generateResult(results: CodecState[], state: CodecState): CodecState {
		const result: Value = { tag: 'VSeq', value: results.map((state) => state.value) }
		return { env: mergeEnvironments(...results.map((state) => state.env)), value: { tag: 'VSeq', value: [result, state.value] } }
	}

	return (...args: CodecFunc[]) => ({
		forward: (state, cb) => {
			// Each call to pattern consumes an A and produces a [B, A]
			// We cycle this at least min times, and at most max times(or until the pattern fails if max is undefined)
			const results: CodecState[] = []
			let i = 0
			const pattern = compiledPattern(...args)
			while (max === undefined || i < max) {
				let newState: CodecState | undefined
				pattern.forward(state, (state) => newState = state)

				if (newState === undefined) {
					if (i < min) return cb(undefined)
					return cb(generateResult(results, state))
				}

				if (newState.value.tag !== 'VSeq') return cb(undefined)
				if (newState.value.value.length !== 2) return cb(undefined)

				results.push({ env: newState.env, value: newState.value.value[0] })
				state = { env: mergeEnvironments(state.env, newState.env), value: newState.value.value[1] }

				i++
			}

			return cb(generateResult(results, state))
		},
		backward: (state, cb) => {
			if (state.value.tag !== 'VSeq') return cb(undefined)
			if (state.value.value.length !== 2) return cb(undefined)
			if (state.value.value[0].tag !== 'VSeq') return cb(undefined)

			const results = state.value.value[0].value
			const pattern = compiledPattern(...args)
			state.value = state.value.value[1]

			for (let i = results.length - 1; i >= 0; i--) {
				const value: Value = { tag: 'VSeq', value: [results[i], state.value] }
				pattern.backward({ env: state.env, value }, (newState) => {
					if (newState === undefined) return cb(undefined)
					state = newState
				})
			}

			return cb(state)
		},
	})
}
