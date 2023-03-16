import { rangeMap, remove } from '../Utilities'
import { Term, Tag, SeqTerm, VarTerm, NilTerm, ConsTerm, SnocTerm, SetTerm, LitTerm, SubsetTerm, Var, EmptyTerm } from './AST'
import { Goal, conj, eq, exists, disj, State } from './Goals'
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
		case Tag.Seq: return term[1].some((t) => occurs(name, t))
		case Tag.Nil: return false
		case Tag.Cons: return occurs(name, term[1]) || occurs(name, term[2])
		case Tag.Snoc: return occurs(name, term[1]) || occurs(name, term[2])
		case Tag.Set: return term[1].some((t) => occurs(name, t))
		case Tag.Empty: return false
		case Tag.Subset: return term[1].some((t) => occurs(name, t)) || occurs(name, term[2])
	}
}

export function eqBind(lhs: VarTerm, rhs: Term): Goal {
	return (state) => {
		if (rhs[0] === Tag.Var && lhs[1] === rhs[1]) return singleton(state)
		if (occurs(lhs[1], rhs)) return empty()
		return singleton({ ...state, env: new Map(state.env).set(lhs[1], rhs) })
	}
}

export function eqSeqSeq(lhs: SeqTerm, rhs: SeqTerm): Goal {
	if (lhs[1].length !== rhs[1].length) return failure()
	return conj(...rangeMap(lhs[1].length, (i) => eq(lhs[1][i], rhs[1][i])))
}

export function eqSeqNil(lhs: SeqTerm, rhs: NilTerm): Goal {
	return lhs[1].length === 0 ? success() : failure()
}

export function eqSeqCons(lhs: SeqTerm, rhs: ConsTerm): Goal {
	if (lhs[1].length === 0) return failure()
	return conj(eq(lhs[1][0], rhs[1]), eq([Tag.Seq, lhs[1].slice(1)], rhs[2]))
}

export function eqConsCons(lhs: ConsTerm, rhs: ConsTerm): Goal {
	return conj(eq(lhs[1], rhs[1]), eq(lhs[2], rhs[2]))
}

export function eqSnocSeq(lhs: SnocTerm, rhs: SeqTerm): Goal {
	if (rhs[1].length === 0) return failure()
	return conj(eq(lhs[1], [Tag.Seq, rhs[1].slice(0, -1)]), eq(lhs[2], rhs[1][rhs[1].length - 1]))
}

export function eqSnocCons(lhs: SnocTerm, rhs: ConsTerm): Goal {
	return disj(
		// [...lhsHead, lhsTail] = [rhsHead, ...rhsTail] => lhsTail = rhsHead /\ lhsHead = [] /\ rhsTail = []
		conj(eq(lhs[2], rhs[1]), eq(lhs[1], [Tag.Nil]), eq(rhs[1], [Tag.Nil])),
		// [...lhsHead, lhsTail] = [rhsHead, ...rhsTail] => exists xs. lhsHead = [rhsHead, ...xs] /\ [...xs, lhsTail] = rhsTail
		exists((xs: Term) => conj(eq(lhs[1], [Tag.Cons, rhs[1], xs]), eq([Tag.Snoc, xs, lhs[2]], rhs[2])))
	)
}

export function eqSnocSnoc(lhs: SnocTerm, rhs: SnocTerm): Goal {
	return conj(eq(lhs[1], rhs[1]), eq(lhs[2], rhs[2]))
}

export function eqSetSet(lhs: SetTerm, rhs: SetTerm): Goal {
	if (lhs[1].length !== rhs[1].length) return failure()
	if (lhs[1].length === 0) return success()
	return disj(...rhs[1].map((v, i) => conj(eq(lhs[1][0], v), eq([Tag.Set, lhs[1].slice(1)], [Tag.Set, remove(rhs[1], i)]))))
}

export function eqSubsetSet(lhs: SubsetTerm, rhs: SetTerm): Goal {
	if (lhs[1].length === 0) return eq(lhs[2], rhs)
	return disj(...rhs[1].map((v, i) => conj(eq(lhs[1][0], v), eq([Tag.Subset, lhs[1].slice(1), lhs[2]], [Tag.Set, remove(rhs[1], i)]))))
}

export function eqSubsetEmpty(lhs: SubsetTerm, rhs: EmptyTerm): Goal {
	return maybe(lhs[1].length === 0, eq(lhs[2], [Tag.Empty]))
}

export function eqSubsetSubset(lhs: SubsetTerm, rhs: SubsetTerm): Goal {
	if (lhs[1].length === 0) return eq(lhs[2], rhs)
	if (rhs[1].length === 0) return eq(lhs, rhs[2])
	return disj(
		...rhs[1].map((v, i) => conj(eq(lhs[1][0], v), eq([Tag.Subset, lhs[1].slice(1), lhs[2]], [Tag.Subset, remove(rhs[1], i), rhs[2]]))),
		exists((rest) => eq([Tag.Subset, lhs[1], rest], rhs)),
	)
}

let _unifierStash: Unifier[][] | undefined
export function getUnifiers(): Unifier[][] {
	if (_unifierStash) return _unifierStash

	// Start with empty table
	const fail: Unifier = () => () => empty<State>()
	const unifiers: Unifier[][] = rangeMap(Tag._Count, () => rangeMap(Tag._Count, () => fail))

	// Fill in non-failure cases, starting with the basic ones
	unifiers[Tag.Lit][Tag.Lit] = eqLitLit as Unifier
	for (let i = 0; i < Tag._Count; i++) unifiers[Tag.Var][i] = eqBind as Unifier
	
	// Seq, Nil, Cons, and Snoc are all related
	unifiers[Tag.Seq][Tag.Seq] = eqSeqSeq as Unifier
	unifiers[Tag.Seq][Tag.Nil] = eqSeqNil as Unifier
	unifiers[Tag.Seq][Tag.Cons] = eqSeqCons as Unifier
	unifiers[Tag.Nil][Tag.Nil] = success as Unifier
	unifiers[Tag.Cons][Tag.Cons] = eqConsCons as Unifier
	unifiers[Tag.Snoc][Tag.Seq] = eqSnocSeq as Unifier
	unifiers[Tag.Snoc][Tag.Cons] = eqSnocCons as Unifier
	unifiers[Tag.Snoc][Tag.Snoc] = eqSnocSnoc as Unifier

	// Set, Empty, and Subset are all related
	unifiers[Tag.Set][Tag.Set] = eqSetSet as Unifier
	unifiers[Tag.Empty][Tag.Empty] = success as Unifier
	unifiers[Tag.Empty][Tag.Set] = eqEmptySet as Unifier
	unifiers[Tag.Subset][Tag.Set] = eqSubsetSet as Unifier
	unifiers[Tag.Subset][Tag.Empty] = eqSubsetEmpty as Unifier
	unifiers[Tag.Subset][Tag.Subset] = eqSubsetSubset as Unifier

	// Make unifiers symmetric
	for (let i = 0; i < Tag._Count; i++) {
		for (let j = 0; j < Tag._Count; j++) {
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
