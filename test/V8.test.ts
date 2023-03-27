export type Value = number | string | Value[]
export type Rule = [Value[], Value[]]
export type Env = (Value | undefined)[]

export type RuleThread = { env: Env, andThreads: [Value, Value][], bottom: Value[], path: number }
export type CycleThread = { rules: Rule[], path: number[], orThreads: RuleThread[], results: { path: number, value: Value }[] }
export type ProgramThread = { cycles: CycleThread[], results: { path: number[], rules: Rule[], value: Value }[] }

export enum RuleThreadStepResult { Failure, Complete, Continue }
export enum CycleThreadStepResult { Complete, Continue }
export enum ProgramThreadStepResult { Complete, Continue }

export function init(rules: Rule[], value: Value, path: number[] = []): ProgramThread {
	const orThreads: RuleThread[] = rules.map((rule, path): RuleThread => ({ env: [], andThreads: rule[0].map((v): [Value, Value] => [v, value]), bottom: rule[1], path }))
	const cycles: CycleThread[] = [{ rules, path, orThreads, results: [] }]
	const result: ProgramThread = { cycles, results: [] }
	return result
}

export function walk(env: Env, value: Value): Value {
	if (typeof value === 'number') {
		const v = env[value]
		return v ? walk(env, v) : value
	}
	return value
}

export function subst(env: Env, value: Value): Value {
	if (typeof value === 'number') return walk(env, value)
	else if (typeof value === 'string') return value
	else return value.map((v) => subst(env, v))
}

export function occurs(varNum: number, value: Value): boolean {
	if (typeof value === 'number') return varNum === value
	else if (typeof value === 'string') return false
	else return value.some((v) => occurs(varNum, v))
}

export function stepRuleThread(thread: RuleThread): RuleThreadStepResult {
	if (thread.andThreads.length === 0) return RuleThreadStepResult.Complete

	const [lhs, rhs] = thread.andThreads.pop()!.map((v) => walk(thread.env, v))
	if (lhs === rhs) return RuleThreadStepResult.Continue
	else if (typeof lhs === 'number') {
		if (occurs(lhs, rhs)) return RuleThreadStepResult.Failure
		thread.env[lhs] = rhs
	} else if (typeof rhs === 'number') {
		if (occurs(rhs, lhs)) return RuleThreadStepResult.Failure
		thread.env[rhs] = lhs
	} else if (typeof lhs === 'string' || typeof rhs === 'string') return RuleThreadStepResult.Failure
	else if (lhs.length !== rhs.length) return RuleThreadStepResult.Failure
	else thread.andThreads.push(...lhs.map((v, i): [Value, Value] => [v, rhs[i]]))

	return RuleThreadStepResult.Continue
}

export function stepCycleThread(machine: CycleThread): CycleThreadStepResult {
	const thread = machine.orThreads.pop()
	if (!thread) return CycleThreadStepResult.Complete

	const result = stepRuleThread(thread)
	if (result === RuleThreadStepResult.Complete) {
		machine.results.push(...thread.bottom.map((v) => ({ path: thread.env.length, value: subst(thread.env, v) })))
	} else if (result === RuleThreadStepResult.Continue) {
		machine.orThreads.push(thread)
	}

	return CycleThreadStepResult.Continue
}

export function stepProgramThread(prog: ProgramThread): ProgramThreadStepResult {
	const thread = prog.cycles.pop()
	if (!thread) return ProgramThreadStepResult.Complete

	const result = stepCycleThread(thread)
	if (result === CycleThreadStepResult.Complete) {
		prog.results.push(...thread.results.map((v) => ({ path: thread.path.concat(v.path), value: v.value, rules: thread.rules })))
	} else if (result === CycleThreadStepResult.Continue) {
		prog.cycles.push(thread)
	}

	return ProgramThreadStepResult.Continue
}

export function runProgramThread(prog: ProgramThread): void {
	while (true) {
		const oldResults = prog.results.slice()
		// Step the program thread until it completes the current cycle
		prog.results = []
		while (stepProgramThread(prog) === ProgramThreadStepResult.Continue) {}
		prog.cycles = prog.results.map((v) => init(v.rules, v.value, v.path).cycles[0])
		if (prog.results.length === 0) {
			prog.results = oldResults
			break
		}
	}
}

describe('V8', () => {
	describe('ProgramThread', () => {
		it('Should run a program thread', () => {
			const program = init([[['a'], ['b']], [['b'], ['c']]], 'a')
			runProgramThread(program)
			expect(program.results).toEqual([{ path: [0, 0], value: 'c', rules: [[['a'], ['b']], [['b'], ['c']]] }])
		})
	})
})
