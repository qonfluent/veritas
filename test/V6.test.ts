export enum Tag { Lit, Var, Seq }
export type Term = [Tag.Lit, Uint8Array] | [Tag.Var, number] | [Tag.Seq, Term[]]
export type Subst = Term[]
// FIXME: Should be like export type Rule = [Term[], Term[]]
export type Rule = { top: Term, bottom: Term }
export type Language = { rules: Rule[] }
export type Thread = { language: Language, state: Term, ruleIndex: number, sparked: boolean }
export type Machine = { active: Thread[], yielded: Thread[] }

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
	else if (lhs[0] === Tag.Var && rhs[0] === Tag.Var) return lhs[1] === rhs[1] ? subst : extend(lhs[1], rhs)
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

export function stepMachine(machine: Machine, forward = true): void {
	// Get a thread or return if there are no threads
	const thread = machine.active.pop()
	if (thread === undefined) return

	// Unify the next rule with the state and push the new thread if the unification succeeds
	const rule = thread.language.rules[thread.ruleIndex++]
	const unifier = unify([], forward ? rule.top : rule.bottom, thread.state)
	if (unifier) {
		machine.active.push({ ...thread, state: fullWalk(unifier, forward ? rule.bottom : rule.top), ruleIndex: 0, sparked: false })
		thread.sparked = true
	}

	// Push the thread back if there are more rules to go, otherwise yield
	if (thread.ruleIndex < thread.language.rules.length) machine.active.push(thread)
	else if (!thread.sparked) machine.yielded.push(thread)
}

export function runMachine(machine: Machine, forward = true): void {
	while (machine.active.length > 0) stepMachine(machine, forward)
}

describe('V6', () => {
	describe('Unify', () => {
		it('should unify two lits', () => {
			const subst = unify([], [Tag.Lit, Buffer.from('a')], [Tag.Lit, Buffer.from('a')])
			expect(subst).toEqual([])
		})

		it('should not unify two different lits', () => {
			const subst = unify([], [Tag.Lit, Buffer.from('a')], [Tag.Lit, Buffer.from('b')])
			expect(subst).toBeUndefined()
		})

		it('should unify two vars', () => {
			const subst = unify([], [Tag.Var, 0], [Tag.Var, 0])
			expect(subst).toEqual([])
		})

		it('should unify a var and a lit', () => {
			const subst = unify([], [Tag.Var, 0], [Tag.Lit, Buffer.from('a')])
			expect(subst).toEqual([[Tag.Lit, Buffer.from('a')]])
		})

		it('should unify a lit and a var', () => {
			const subst = unify([], [Tag.Lit, Buffer.from('a')], [Tag.Var, 0])
			expect(subst).toEqual([[Tag.Lit, Buffer.from('a')]])
		})

		it('should unify two seqs', () => {
			const subst = unify([], [Tag.Seq, [[Tag.Lit, Buffer.from('a')]]], [Tag.Seq, [[Tag.Lit, Buffer.from('a')]]])
			expect(subst).toEqual([])
		})

		it('should not unify two different seqs', () => {
			const subst = unify([], [Tag.Seq, [[Tag.Lit, Buffer.from('a')]]], [Tag.Seq, [[Tag.Lit, Buffer.from('b')]]])
			expect(subst).toBeUndefined()
		})

		it('should unify two seqs with vars', () => {
			const subst = unify([], [Tag.Seq, [[Tag.Var, 0]]], [Tag.Seq, [[Tag.Var, 0]]])
			expect(subst).toEqual([])
		})

		it('should unify two seqs with vars and lits', () => {
			const subst = unify([], [Tag.Seq, [[Tag.Var, 0], [Tag.Lit, Buffer.from('a')]]], [Tag.Seq, [[Tag.Var, 0], [Tag.Lit, Buffer.from('a')]]])
			expect(subst).toEqual([])
		})

		it('should unify two seqs with different vars', () => {
			const subst = unify([], [Tag.Seq, [[Tag.Var, 0]]], [Tag.Seq, [[Tag.Var, 1]]])
			expect(subst).toEqual([[Tag.Var, 1]])
		})
	})

	describe('Step', () => {
		it('should step a machine', () => {
			const machine: Machine = {
				active: [
					{
						language: {
							rules: [
								{ top: [Tag.Lit, Buffer.from('a')], bottom: [Tag.Lit, Buffer.from('b')] },
								{ top: [Tag.Lit, Buffer.from('b')], bottom: [Tag.Lit, Buffer.from('c')] },
							],
						},
						state: [Tag.Lit, Buffer.from('a')],
						ruleIndex: 0,
						sparked: false,
					},
				],
				yielded: [],
			}

			stepMachine(machine)

			expect(machine.active.length).toBe(2)
			expect(machine.active[0].state).toEqual([Tag.Lit, Buffer.from('b')])
			expect(machine.active[0].ruleIndex).toBe(0)
			expect(machine.active[0].sparked).toBe(false)
			expect(machine.active[1].state).toEqual([Tag.Lit, Buffer.from('a')])
			expect(machine.active[1].ruleIndex).toBe(1)
			expect(machine.active[1].sparked).toBe(true)
			expect(machine.yielded.length).toBe(0)
		})
	})

	describe('Run', () => {
		it('should run a machine', () => {
			const machine: Machine = {
				active: [
					{
						language: {
							rules: [
								{ top: [Tag.Lit, Buffer.from('a')], bottom: [Tag.Lit, Buffer.from('b')] },
								{ top: [Tag.Lit, Buffer.from('b')], bottom: [Tag.Lit, Buffer.from('c')] },
							],
						},
						state: [Tag.Lit, Buffer.from('a')],
						ruleIndex: 0,
						sparked: false,
					},
				],
				yielded: [],
			}

			runMachine(machine)

			expect(machine.active.length).toBe(0)
			expect(machine.yielded.length).toBe(1)
			expect(machine.yielded[0].state).toEqual([Tag.Lit, Buffer.from('c')])
			expect(machine.yielded[0].ruleIndex).toBe(2)
			expect(machine.yielded[0].sparked).toBe(true)
		})
	})

	describe('Peano numbers', () => {
		it('should add two numbers', () => {
			const peano: Machine = {
				active: [
					{
						language: {
							rules: [
								{ top: [Tag.Seq, []], bottom: [] }
							],
						},
						state: [Tag.Seq, []],
						ruleIndex: 0,
						sparked: false,
					},
				],
				yielded: [],
			}
		})
	})
})
