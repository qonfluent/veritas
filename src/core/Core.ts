export type Value = number | string | Value[]
export type Rule = { top: Value[], bottom: Value[] }
export type Program = { rules: Rule[], value: Value }

export type Env = (Value | undefined)[]
export type UnifyState = { lhs: Value, rhs: Value }
export type RuleState = { env: Env, unifiers: UnifyState[], ruleIndex: number, ctx: number[] }
export type ProgramResult = Program & { path: number[] }
export type CycleState = ProgramResult & { pending: RuleState[], complete: { ruleIndex: number, value: Value }[] }
export type ProgramState = { cycles: CycleState[], complete: ProgramResult[] }

function spawnPending(prog: Program): RuleState[] {
	const applied = prog.rules.flatMap((rule, ruleIndex): RuleState => ({ env: [], unifiers: rule.top.map((lhs) => ({ lhs, rhs: prog.value })), ruleIndex, ctx: [] }))
	const innerApplied = prog.value instanceof Array ? prog.value.flatMap((v, i) => {
		const inner = spawnPending({ rules: prog.rules, value: v })
		return inner.map((state) => ({ ...state, ctx: [...state.ctx, i] }))
	}) : []
	return applied.concat(innerApplied)
}

export function step(prog: ProgramState): void {
	const cycle = prog.cycles.pop()
	if (!cycle) return

	const rule = cycle.pending.pop()
	if (!rule) {
		if (cycle.complete.length === 0) {
			prog.complete.push({ path: cycle.path, rules: cycle.rules, value: cycle.value })
		} else {
			prog.cycles.push(...cycle.complete.map(({ ruleIndex, value }): CycleState => ({
				rules: cycle.rules,
				value,
				path: [...cycle.path, ruleIndex],
				pending: spawnPending({ rules: cycle.rules, value }),
				complete: [],
			})))
		}

		return
	}

	const expand = (env: Env, value: Value): Value => {
		if (typeof value === 'number') return env[value] ? expand(env, env[value]!) : value
		else if (typeof value === 'string') return value
		else return value.map((v) => expand(env, v))
	}

	const bind = (varNum: number, value: Value): void => {
		// @ts-ignore
		if (value instanceof Array && value.flat(2**31 - 1).indexOf(varNum) !== -1) return
		env[varNum] = value
		cycle.pending.push({ env, unifiers, ruleIndex, ctx: rule.ctx })
	}

	const inject = (base: Value, path: number[], value: Value): Value => {
		if (path.length === 0) return value
		else if (base instanceof Array) {
			const [i, ...rest] = path
			return base.map((v, j) => j === i ? inject(v, rest, value) : v)
		} else throw new Error('Cannot inject into non-array')
	}

	const { env, unifiers, ruleIndex, ctx } = rule
	const unifier = unifiers.pop()
	if (!unifier) {
		cycle.complete.push(...cycle.rules[ruleIndex].bottom.map((bottom) => {
			const expanded = expand(env, bottom)
			const value = inject(cycle.value, ctx, expanded)
			return { ruleIndex, value }
		}))
	} else {
		const [lhs, rhs] = [unifier.lhs, unifier.rhs].map((v) => expand(env, v))
		if (lhs === rhs) cycle.pending.push({ env, unifiers, ruleIndex, ctx: rule.ctx })
		else if (typeof lhs === 'number') bind(lhs, rhs)
		else if (typeof rhs === 'number') bind(rhs, lhs)
		else if (lhs instanceof Array && rhs instanceof Array && lhs.length === rhs.length) {
			cycle.pending.push({ env, unifiers: lhs.map((l, i) => ({ lhs: l, rhs: rhs[i] })).concat(unifiers), ruleIndex, ctx: rule.ctx })
		}
	}

	prog.cycles.push(cycle)
}

export function run(prog: Program): ProgramResult[] {
	const state: ProgramState = {
		cycles: [{
			...prog,
			path: [],
			pending: spawnPending(prog),
			complete: [],
		}],
		complete: [],
	}

	let steps = 0
	while (state.cycles.length > 0) {
		step(state)
		steps++
	}

	console.log(`Ran ${steps} steps`)

	return state.complete
}
