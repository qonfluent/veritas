export type Value = string | number | Value[]
export type Env = (Value | undefined)[]
export type Machine = {
	failed: boolean
	env: Env
	todo: [Value, Value][]
}

export function step(machine: Machine): void {
	if (machine.failed || machine.todo.length === 0) return

	const [lhs, rhs] = machine.todo.pop()!.map((v) => typeof v === 'number' ? machine.env[v] ?? v : v)
	if (lhs === rhs) return
	else if (typeof lhs === 'number') machine.env[lhs] = rhs
	else if (typeof rhs === 'number') machine.env[rhs] = lhs
	else if (typeof lhs === 'string' || typeof rhs === 'string') machine.failed = true
	else if (lhs.length !== rhs.length) machine.failed = true
	else machine.todo.push(...lhs.map((v, i): [Value, Value] => [v, rhs[i]]))
}

export function run(machine: Machine): void {
	while (!machine.failed && machine.todo.length > 0) {
		step(machine)
	}
}

export function unify(lhs: Value, rhs: Value): Env | undefined {
	const machine: Machine = { failed: false, env: [], todo: [[lhs, rhs]] }
	run(machine)
	return machine.failed ? undefined : machine.env
}

describe('unify', () => {
	it('should unify literals', () => {
		expect(unify('a', 'a')).toEqual([])
		expect(unify('a', 'b')).toBeUndefined()
	})

	it('should unify variables', () => {
		expect(unify(0, 'a')).toEqual(['a'])
		expect(unify(0, 1)).toEqual([1])
	})

	it('should unify lists', () => {
		expect(unify(['a', 0], ['a', 1])).toEqual([1])
		expect(unify(['a', 0], ['b', 1])).toBeUndefined()
		expect(unify(['a', 0], ['a', 1, 2])).toBeUndefined()
	})

	it('should unify nested lists', () => {
		expect(unify(['a', ['b', 0]], ['a', ['b', 1]])).toEqual([1])
		expect(unify(['a', ['b', 0]], ['a', ['b', 1, 2]])).toBeUndefined()
		expect(unify(['a', ['b', 0]], ['a', ['c', 1]])).toBeUndefined()
	})

	it('should unify lists with variables matching literals', () => {
		expect(unify(['a', 0], ['a', 'b'])).toEqual(['b'])
		expect(unify(['a', 'b'], ['a', 0])).toEqual(['b'])
	})
})
