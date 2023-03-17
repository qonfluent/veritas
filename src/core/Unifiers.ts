import { rangeMap } from '../Utilities'
import { Term, Tag, VarTerm, ConsTerm, LitTerm, Var } from './AST'
import { Goal, conj, eq, State } from './Goals'
import { empty, singleton } from './Stream'

export type Unifier = (lhs: Term, rhs: Term) => Goal

export function failure(): Goal {
	return () => empty()
}

export function success(): Goal {
	return (state) => singleton(state)
}

export function maybe(test: boolean, goal: Goal = success()): Goal {
	return test ? goal : failure()
}

export function eqLitLit(lhs: LitTerm, rhs: LitTerm): Goal {
	if (lhs instanceof Uint8Array && rhs instanceof Uint8Array) return maybe(Buffer.compare(lhs, rhs) === 0)
	return maybe(lhs[1] === rhs[1])
}

export function occurs(name: Var, term: Term): boolean {
	switch (term[0]) {
		case Tag.Lit: return false
		case Tag.Var: return name === term[1]
		case Tag.Nil: return false
		case Tag.Cons: return occurs(name, term[1]) || occurs(name, term[2])
	}
}

export function eqBind(lhs: VarTerm, rhs: Term): Goal {
	return (state) => {
		if (rhs[0] === Tag.Var && lhs[1] === rhs[1]) return singleton(state)
		if (occurs(lhs[1], rhs)) return empty()
		return singleton({ ...state, env: { ...state.env, [lhs[1]]: rhs } })
	}
}

export function eqConsCons(lhs: ConsTerm, rhs: ConsTerm): Goal {
	return conj(eq(lhs[1], rhs[1]), eq(lhs[2], rhs[2]))
}

let _unifierStash: Record<Tag, Record<Tag, Unifier>> | undefined
export function getUnifiers(): Record<Tag, Record<Tag, Unifier>> {
	if (_unifierStash) return _unifierStash

	// Get parameters
	const tagCount = Object.keys(Tag).length / 2

	// Start with empty table
	const fail: Unifier = () => () => empty<State>()
	const unifiers: Record<Tag, Record<Tag, Unifier>> = {} as any
	for (let i = 0; i < tagCount; i++) {
		unifiers[i] = {} as any
		for (let j = 0; j < tagCount; j++) {
			unifiers[i][j] = fail
		}
	}

	// Fill in non-failure cases, starting with the basic ones
	unifiers[Tag.Lit][Tag.Lit] = eqLitLit as Unifier
	unifiers[Tag.Var][Tag.Lit] = eqBind as Unifier
	unifiers[Tag.Var][Tag.Var] = eqBind as Unifier
	unifiers[Tag.Var][Tag.Nil] = eqBind as Unifier
	unifiers[Tag.Var][Tag.Cons] = eqBind as Unifier
	
	// Seq, Nil, Cons, and Snoc are all related
	unifiers[Tag.Nil][Tag.Nil] = success as Unifier
	unifiers[Tag.Cons][Tag.Cons] = eqConsCons as Unifier

	// Make unifiers symmetric
	for (let i = 0; i < tagCount; i++) {
		for (let j = 0; j < tagCount; j++) {
			if (unifiers[i][j] === fail && unifiers[j][i] !== fail) {
				unifiers[i][j] = (lhs, rhs) => unifiers[j][i](rhs, lhs)
				Object.defineProperty(unifiers[i][j], 'name', { value: unifiers[j][i].name })
			}
		}
	}

	// Update stash and return
	_unifierStash = unifiers
	return unifiers
}
