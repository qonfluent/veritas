import { Language } from "../../src/language/AST"
import { CodecFuncGroup, compileLanguage } from "../../src/language/Compiler"

describe('Pattern Language', () => {
	describe('Pattern Language Unit Tests', () => {
		const lang: Language = {
			'any': { args: [], body: { tag: 'PAny' } },
			'none': { args: [], body: { tag: 'PNone' } },
			'value': { args: [], body: { tag: 'PValue', value: { tag: 'VString', value: 'foo' } } },
			'bind': { args: [], body: { tag: 'PBind', name: 'x', pattern: { tag: 'PAny' } } },
			'call': { args: [], body: { tag: 'PCall', name: 'any', args: [] } },
			'then': { args: [], body: { tag: 'PThen', patterns: [
				{ tag: 'PValue', value: { tag: 'VString', value: 'foo' } },
				{ tag: 'PAny' },
			] } },
			'str': { args: [], body: { tag: 'PStr', value: 'foo' } },
			'regex': { args: [], body: { tag: 'PRegex', value: /foo/ } },
			'maybe': { args: [], body: { tag: 'PRepeat', pattern: { tag: 'PRegex', value: /foo/ }, min: 0, max: 1 } },
			'count': { args: [], body: { tag: 'PRepeat', pattern: { tag: 'PRegex', value: /foo/ }, min: 3, max: 3 } },
			'range': { args: [], body: { tag: 'PRepeat', pattern: { tag: 'PRegex', value: /foo/ }, min: 1, max: 3 } },
			'many': { args: [], body: { tag: 'PRepeat', pattern: { tag: 'PRegex', value: /foo/ }, min: 0 } },
			'plus': { args: [], body: { tag: 'PRepeat', pattern: { tag: 'PRegex', value: /foo/ }, min: 1 } },
			'alt': { args: [], body: { tag: 'PAlt', patterns: [
				{ tag: 'PRegex', value: /foo/ },
				{ tag: 'PRegex', value: /bar/ },
			] } },
		}

		let compiled: CodecFuncGroup

		it('Can compile a language', () => {
			compiled = compileLanguage(lang)
		})

		describe('Positive unit tests', () => {
			it('Can run the "any" function', (done) => {
				compiled.any().forward({ env: {}, value: { tag: 'VString', value: 'foo' } }, (state) => {
					expect(state).not.toBe(undefined)
					
					compiled.any().backward(state!, (state) => {
						expect(state).not.toBe(undefined)
						done()
					})
				})
			})

			it('Can run the "none" function', (done) => {
				compiled.none().forward({ env: {}, value: { tag: 'VString', value: 'foo' } }, (state) => {
					expect(state).toBe(undefined)
					
					compiled.none().backward(state!, (state) => {
						expect(state).toBe(undefined)
						done()
					})
				})
			})

			it('Can run the "value" function', (done) => {
				compiled.value().forward({ env: {}, value: { tag: 'VString', value: 'foo' } }, (state) => {
					expect(state).toEqual({ env: {}, value: { tag: 'VUnit' }})
					
					compiled.value().backward(state!, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VString', value: 'foo' } })
						done()
					})
				})
			})

			it('Can run the "bind" function', (done) => {
				compiled.bind().forward({ env: {}, value: { tag: 'VString', value: 'foo' } }, (state) => {
					expect(state).not.toBe(undefined)
					expect(state!.env.x).toEqual({ tag: 'VString', value: 'foo' })
					

					compiled.bind().backward(state!, (state) => {
						expect(state).toEqual({ env: { x: { tag: 'VString', value: 'foo' } }, value: { tag: 'VString', value: 'foo' } })
						done()
					})
				})
			})

			it('Can run the "call" function', (done) => {
				compiled.call().forward({ env: {}, value: { tag: 'VString', value: 'foo' } }, (state) => {
					expect(state).not.toBe(undefined)
					
					compiled.call().backward(state!, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VString', value: 'foo' } })
						done()
					})
				})
			})

			it('Can run the "then" function', (done) => {
				compiled.then().forward({ env: {}, value: { tag: 'VString', value: 'foo' } }, (state) => {
					expect(state).toEqual({ env: {}, value: { tag: 'VUnit' } })
					
					compiled.then().backward(state!, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VString', value: 'foo' } })
						done()
					})
				})
			})

			it('Can run the "str" function', (done) => {
				compiled.str().forward({ env: {}, value: { tag: 'VString', value: 'foobar' } }, (state) => {
					expect(state).toEqual({ env: {}, value: { tag: 'VString', value: 'bar' } })
					
					compiled.str().backward(state!, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VString', value: 'foobar' } })
						done()
					})
				})
			})

			it('Can run the "regex" function', (done) => {
				compiled.regex().forward({ env: {}, value: { tag: 'VString', value: 'foobar' } }, (state) => {
					expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
						{ tag: 'VString', value: 'foo' },
						{ tag: 'VString', value: 'bar' },
					] } })
					
					compiled.regex().backward(state!, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VString', value: 'foobar' } })
						done()
					})
				})
			})

			it('Can run the "maybe" function', (done) => {
				compiled.maybe().forward({ env: {}, value: { tag: 'VString', value: 'foobar' } }, (state) => {
					expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
						{ tag: 'VSeq', value: [
							{ tag: 'VString', value: 'foo' },
						] },
						{ tag: 'VString', value: 'bar' },
					] } })
					
					compiled.maybe().backward(state!, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VString', value: 'foobar' } })
						done()
					})
				})
			})

			it('Can run the "count" function', (done) => {
				compiled.count().forward({ env: {}, value: { tag: 'VString', value: 'foofoofoobar' } }, (state) => {
					expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
						{ tag: 'VSeq', value: [
							{ tag: 'VString', value: 'foo' },
							{ tag: 'VString', value: 'foo' },
							{ tag: 'VString', value: 'foo' },
						] },
						{ tag: 'VString', value: 'bar' },
					] } })
					
					compiled.count().backward(state!, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VString', value: 'foofoofoobar' } })
						done()
					})
				})
			})

			it('Can run the "range" function', (done) => {
				compiled.range().forward({ env: {}, value: { tag: 'VString', value: 'foofoofoobar' } }, (state) => {
					expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
						{ tag: 'VSeq', value: [
							{ tag: 'VString', value: 'foo' },
							{ tag: 'VString', value: 'foo' },
							{ tag: 'VString', value: 'foo' },
						] },
						{ tag: 'VString', value: 'bar' },
					] } })
					
					compiled.range().backward(state!, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VString', value: 'foofoofoobar' } })
						done()
					})
				})
			})

			it('Can run the "many" function', (done) => {
				compiled.many().forward({ env: {}, value: { tag: 'VString', value: 'foofoofoobar' } }, (state) => {
					expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
						{ tag: 'VSeq', value: [
							{ tag: 'VString', value: 'foo' },
							{ tag: 'VString', value: 'foo' },
							{ tag: 'VString', value: 'foo' },
						] },
						{ tag: 'VString', value: 'bar' },
					] } })
					
					compiled.many().backward(state!, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VString', value: 'foofoofoobar' } })
						done()
					})
				})
			})

			it('Can run the "plus" function', (done) => {
				compiled.plus().forward({ env: {}, value: { tag: 'VString', value: 'foofoofoobar' } }, (state) => {
					expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
						{ tag: 'VSeq', value: [
							{ tag: 'VString', value: 'foo' },
							{ tag: 'VString', value: 'foo' },
							{ tag: 'VString', value: 'foo' },
						] },
						{ tag: 'VString', value: 'bar' },
					] } })
					
					compiled.plus().backward(state!, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VString', value: 'foofoofoobar' } })
						done()
					})
				})
			})

			it('Can run the "alt" function', (done) => {
				compiled.alt().forward({ env: {}, value: { tag: 'VString', value: 'foo' } }, (state) => {
					expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
						{ tag: 'VString', value: 'foo' },
						{ tag: 'VString', value: '' },
					] } })
				})

				compiled.alt().forward({ env: {}, value: { tag: 'VString', value: 'bar' } }, (state) => {
					expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
						{ tag: 'VString', value: 'bar' },
						{ tag: 'VString', value: '' },
					] } })
					done()
				})
			})
		})

		describe('Negative unit tests', () => {
			describe('Type checking', () => {
				it('Can fail the "value" function', (done) => {
					compiled.value().forward({ env: {}, value: { tag: 'VUnit' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})

				it('Can fail the "str" function', (done) => {
					compiled.str().forward({ env: {}, value: { tag: 'VUnit' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})

				it('Can fail the "regex" function', (done) => {
					compiled.regex().forward({ env: {}, value: { tag: 'VUnit' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})

				it('Can pass the "maybe" function', (done) => {
					compiled.maybe().forward({ env: {}, value: { tag: 'VUnit' } }, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
							{ tag: 'VSeq', value: [] },
							{ tag: 'VUnit' },
						] } })
						done()
					})
				})

				it('Can fail the "count" function', (done) => {
					compiled.count().forward({ env: {}, value: { tag: 'VUnit' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})

				it('Can fail the "range" function', (done) => {
					compiled.range().forward({ env: {}, value: { tag: 'VUnit' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})

				it('Can pass the "many" function', (done) => {
					compiled.many().forward({ env: {}, value: { tag: 'VUnit' } }, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
							{ tag: 'VSeq', value: [] },
							{ tag: 'VUnit' },
						] } })
						done()
					})
				})

				it('Can fail the "plus" function', (done) => {
					compiled.plus().forward({ env: {}, value: { tag: 'VUnit' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})
			})

			describe('Value checking', () => {
				it('Can fail the "value" function', (done) => {
					compiled.value().forward({ env: {}, value: { tag: 'VString', value: 'bar' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})

				it('Can fail the "str" function', (done) => {
					compiled.str().forward({ env: {}, value: { tag: 'VString', value: 'bar' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})

				it('Can fail the "regex" function', (done) => {
					compiled.regex().forward({ env: {}, value: { tag: 'VString', value: 'bar' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})

				it('Can pass the "maybe" function', (done) => {
					compiled.maybe().forward({ env: {}, value: { tag: 'VString', value: 'bar' } }, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
							{ tag: 'VSeq', value: [] },
							{ tag: 'VString', value: 'bar' },
						] } })
						done()
					})
				})

				it('Can fail the "count" function', (done) => {
					compiled.count().forward({ env: {}, value: { tag: 'VString', value: 'bar' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})

				it('Can fail the "range" function', (done) => {
					compiled.range().forward({ env: {}, value: { tag: 'VString', value: 'bar' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})

				it('Can pass the "many" function', (done) => {
					compiled.many().forward({ env: {}, value: { tag: 'VString', value: 'bar' } }, (state) => {
						expect(state).toEqual({ env: {}, value: { tag: 'VSeq', value: [
							{ tag: 'VSeq', value: [] },
							{ tag: 'VString', value: 'bar' },
						] } })
						done()
					})
				})

				it('Can fail the "plus" function', (done) => {
					compiled.plus().forward({ env: {}, value: { tag: 'VString', value: 'bar' } }, (state) => {
						expect(state).toEqual(undefined)
						done()
					})
				})
			})
		})
	})

	describe('Document language', () => {
		const language: Language = {
			//'document': { args: [], body: { tag: 'PRepeat', pattern: { tag: 'PAlt', patterns: [] }} }
		}
	})
})