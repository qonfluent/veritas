export type Value = number | string | Value[]
export type Rule = { top: Value[], bottom: Value[] }
export type Env = (Value | undefined)[]

export type UnifiyState = { lhs: Value, rhs: Value }
export type RuleState = { env: Env, unifiers: UnifiyState[], ruleIndex: number }
export type CycleState = { rules: Rule[], value: Value, path: number[], pending: RuleState[], complete: { ruleIndex: number, value: Value }[] }
export type ProgramResult = { path: number[], rules: Rule[], value: Value }
export type ProgramState = { cycles: CycleState[], complete: ProgramResult[] }

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
				pending: cycle.rules.map((rule, i) => ({ env: [], unifiers: rule.top.map((v) => ({ lhs: value, rhs: v })), ruleIndex: i })),
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
		cycle.pending.push({ env, unifiers, ruleIndex })
	}

	const { env, unifiers, ruleIndex } = rule
	const unifier = unifiers.pop()
	if (!unifier) {
		cycle.complete.push(...cycle.rules[ruleIndex].bottom.map((value) => ({ ruleIndex, value: expand(env, value) })))
	} else {
		const [lhs, rhs] = [unifier.lhs, unifier.rhs].map((v) => expand(env, v))
		if (lhs === rhs) cycle.pending.push({ env, unifiers, ruleIndex })
		else if (typeof lhs === 'number') bind(lhs, rhs)
		else if (typeof rhs === 'number') bind(rhs, lhs)
		else if (lhs instanceof Array && rhs instanceof Array) {
			cycle.pending.push({ env, unifiers: lhs.map((l, i) => ({ lhs: l, rhs: rhs[i] })).concat(unifiers), ruleIndex })
		}
	}

	prog.cycles.push(cycle)
}

export function run(rules: Rule[], value: Value): ProgramResult[] {
	const prog: ProgramState = {
		cycles: [{
			rules,
			value,
			path: [],
			pending: rules.map((rule, i) => ({ env: [], unifiers: rule.top.map((v) => ({ lhs: value, rhs: v })), ruleIndex: i })),
			complete: [],
		}],
		complete: [],
	}

	while (prog.cycles.length > 0) {
		step(prog)
		console.log(JSON.stringify(prog))
	}

	return prog.complete
}
