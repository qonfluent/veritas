export type Var = string

export enum PatternTag {
	Any,
	Bind,
	Eq,
	Tuple,
	Object,
	List,
}

export type Pattern
	= { tag: PatternTag.Any }
	| { tag: PatternTag.Bind, var: Var }
	| { tag: PatternTag.Eq, value: any }
	| { tag: PatternTag.Tuple, patterns: Pattern[] }
	| { tag: PatternTag.Object, patterns: Record<Var, Pattern> }
	| { tag: PatternTag.List, head: Pattern, tail: Pattern }

export enum BodyTag {
	Const,
	Var,
	Tuple,
	Object,
}

export type Body
	= { tag: BodyTag.Const, value: any }
	| { tag: BodyTag.Var, var: Var }
	| { tag: BodyTag.Tuple, bodies: Body[] }
	| { tag: BodyTag.Object, bodies: Record<Var, Body> }

export type Rule = [Pattern, Body]

export type RuleSet = Record<Var, Rule>

export type Proof = [any, ...Var[]]

export function validate(rules: RuleSet, proof: Proof): any | Error {
	const [start, ...steps] = proof
	let state = start

	for (let i = 0; i < steps.length; i++) {
		// Get rule
		const step = steps[i]
		const rule = rules[step]
		if (rule === undefined) {
			return new Error(`Rule ${step} not found at step ${i}`)
		}

		// Get pattern
		const [pattern, body] = rule
		
		// Match pattern
		const matchResult = match(pattern, state)
		if (matchResult instanceof Error) {
			return new Error(`Failed to match pattern at step ${i}: ${matchResult.message}`)
		}

		// Apply body
		state = apply(body, matchResult)
	}

	return state
}

export function match(pattern: Pattern, value: any, ...args: any[]): Record<Var, any> | Error {
	switch (pattern.tag) {
		case PatternTag.Any: {
			return {}
		}
		case PatternTag.Bind: {
			return { [pattern.var]: value }
		}
		case PatternTag.Eq: {
			// FIXME: Horrible hack
			return JSON.stringify(pattern.value) === JSON.stringify(value) ? {} : new Error(`Expected ${pattern.value} but got ${value}`)
		}
		case PatternTag.Tuple: {
			if (!Array.isArray(value)) {
				return new Error(`Expected array but got ${value}`)
			}

			if (pattern.patterns.length !== value.length) {
				return new Error(`Expected array of length ${pattern.patterns.length} but got ${value.length}`)
			}
			
			const result: Record<Var, any> = {}
			for (let i = 0; i < pattern.patterns.length; i++) {
				const matchResult = match(pattern.patterns[i], value[i], ...args)
				if (matchResult instanceof Error) {
					return matchResult
				}

				Object.assign(result, matchResult)
			}

			return result
		}
		case PatternTag.Object: {
			if (typeof value !== 'object') {
				return new Error(`Expected object but got ${value}`)
			}

			const result: Record<Var, any> = {}
			for (const [key, p] of Object.entries(pattern.patterns)) {
				const matchResult = match(p, value[key], ...args)
				if (matchResult instanceof Error) {
					return matchResult
				}

				Object.assign(result, matchResult)
			}

			return result
		}
		case PatternTag.List: {
			if (!Array.isArray(value)) {
				return new Error(`Expected array but got ${value}`)
			}

			const result: Record<Var, any> = {}
			Object.assign(result, match(pattern.head, value[0], ...args[0]))
			Object.assign(result, match(pattern.tail, value.slice(1), ...args[1]))

			return result
		}
	}
}

export function apply(body: Body, vars: Record<Var, any>, ...args: any[]): any | Error {
	switch (body.tag) {
		case BodyTag.Const: {
			return body.value
		}
		case BodyTag.Var: {
			const result = vars[body.var]
			if (result === undefined) {
				return new Error(`Variable ${body.var} not found`)
			}

			return result
		}
		case BodyTag.Tuple: {
			const result: any[] = []
			for (const b of body.bodies) {
				const applyResult = apply(b, vars, ...args)
				if (applyResult instanceof Error) {
					return applyResult
				}

				result.push(applyResult)
			}

			return result
		}
		case BodyTag.Object: {
			const result: Record<Var, any> = {}
			for (const [key, b] of Object.entries(body.bodies)) {
				const applyResult = apply(b, vars, ...args)
				if (applyResult instanceof Error) {
					return applyResult
				}

				result[key] = applyResult
			}

			return result
		}
	}
}
