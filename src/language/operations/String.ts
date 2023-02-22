import { Value } from "../AST"
import { CodecFunc } from "../Compiler"

export function compileStr(value: string): CodecFunc {
	return () => ({
		forward: (state, cb) => {
			switch (state.value.tag) {
				case 'VString': return cb(state.value.value.startsWith(value) ? { ...state, value: { tag: 'VString', value: state.value.value.slice(value.length) } } : undefined)
				default: return cb(undefined)
			}
		},
		backward: (state, cb) => {
			switch (state.value.tag) {
				case 'VString': return cb({ ...state, value: { tag: 'VString', value: value + state.value.value } })
				default: return cb(undefined)
			}
		},
	})
}

export function compileRegex(value: RegExp): CodecFunc {
	return () => ({
		forward: (state, cb) => {
			switch (state.value.tag) {
				case 'VString': {
					const fixedRegex = new RegExp(value.source.startsWith('^') ? value.source : '^' + value.source, value.flags)
					const matches = state.value.value.match(fixedRegex)
					if (matches === null) return cb(undefined)

					const result: Value = { tag: 'VSeq', value: [
						{ tag: 'VString', value: matches[0] },
						{ tag: 'VString', value: state.value.value.slice(matches[0].length) },
					] }

					return cb({ ...state, value: result })
				}
				default: return cb(undefined)
			}
		},
		backward: (state, cb) => {
			switch (state.value.tag) {
				case 'VSeq': {
					if (state.value.value.length !== 2) return cb(undefined)
					if (state.value.value[0].tag !== 'VString') return cb(undefined)
					if (state.value.value[1].tag !== 'VString') return cb(undefined)

					const result: Value = { tag: 'VString', value: state.value.value[0].value + state.value.value[1].value }
					return cb({ ...state, value: result })
				}
				default: return cb(undefined)
			}
		},
	})
}
