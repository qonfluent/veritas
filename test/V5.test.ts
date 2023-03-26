export enum Tag { Lit, Var, Seq }
export type Term = [Tag.Lit, Uint8Array] | [Tag.Var, number] | [Tag.Seq, Term[]]
export type Subst = Term[]

export type Language = { rules: [Term[], Term[]][] }
export type Thread = { language: Language, state: Term }
export type Machine = { threads: Thread[], yielded: Thread[] }

export function walk(subst: Subst, term: Term): Term {
	if (term[0] === Tag.Var) {
		const value = subst[term[1]]
		if (value === undefined) return term
		const result = walk(subst, value)
		subst[term[1]] = result
		return result
	}
	return term
}

export function unify(subst: Subst, lhs: Term, rhs: Term): Subst | undefined {
	const extend = (x: number, v: Term) => {
		const result = subst.slice()
		result[x] = v
		return result
	}

	lhs = walk(subst, lhs)
	rhs = walk(subst, rhs)

	if (lhs[0] === Tag.Lit && rhs[0] === Tag.Lit) return Buffer.compare(lhs[1], rhs[1]) === 0 ? subst : undefined
	else if (lhs[0] === Tag.Var && rhs[0] === Tag.Var) return subst
	else if (lhs[0] === Tag.Var) return extend(lhs[1], rhs)
	else if (rhs[0] === Tag.Var) return extend(rhs[1], lhs)
	else if (lhs[0] === Tag.Seq && rhs[0] === Tag.Seq) {
		if (lhs[1].length !== rhs[1].length) return undefined
		for (let i = 0; i < lhs[1].length; i++) {
			const result = unify(subst, lhs[1][i], rhs[1][i])
			if (result === undefined) return undefined
			subst = result
		}
		return subst
	} else return undefined
}

export function fullWalk(subst: Subst, term: Term): Term {
	switch (term[0]) {
		case Tag.Lit: return term
		case Tag.Var: return walk(subst, term)
		case Tag.Seq: return [Tag.Seq, term[1].map((t) => fullWalk(subst, t))]
	}
}

export function step(m: Machine): void {
	const thread = m.threads.pop()
	if (thread === undefined) return

	const newThreads = thread.language.rules.flatMap(([before, after]) => {
		const combined = before.reduce<Subst | undefined>((acc, t) => acc ? unify(acc, t, thread.state) : undefined, [])
		if (combined === undefined) return []
		return after.map((t) => ({ ...thread, state: fullWalk(combined, t) }))
	})

	m.threads.push(...newThreads)
	if (newThreads.length === 0) m.yielded.push(thread)
}

describe('V5', () => {
	it('should work', () => {
		const machine: Machine = {
			threads: [
				{
					language: {
						rules: [
							[[[Tag.Lit, Buffer.from('a')]], [[Tag.Lit, Buffer.from('b')]]],
							[[[Tag.Lit, Buffer.from('b')]], [[Tag.Lit, Buffer.from('c')]]],
						],
					},
					state: [Tag.Lit, Buffer.from('a')],
				},
			],
			yielded: [],
		}

		step(machine)
		expect(machine.threads).toEqual([{ language: machine.threads[0].language, state: [Tag.Lit, Buffer.from('b')] }])
		expect(machine.yielded).toEqual([])
		step(machine)
		expect(machine.threads).toEqual([{ language: machine.threads[0].language, state: [Tag.Lit, Buffer.from('c')] }])
		expect(machine.yielded).toEqual([])
		step(machine)
		expect(machine.threads).toEqual([])
		expect(machine.yielded).toEqual([{ language: machine.yielded[0].language, state: [Tag.Lit, Buffer.from('c')] }])
	})
})
