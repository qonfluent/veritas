import { Term } from "./AST"
import { bind, empty, map, merge, singleton, Stream } from "./Stream"

// Constraints
export type EqConstraint<A> = { tag: 'eq', lhs: Term<A>, rhs: Term<A> }
export type Constraint<A> = EqConstraint<A>
export type ConstraintSet<A> = Constraint<A>[]

// State
export type State<A> = { constraints: ConstraintSet<A>, nextVar: number }

export function init<A>(): State<A> {
	return { constraints: [], nextVar: 0 }
}

// Goal
export type Goal<A> = (state: State<A>) => Stream<State<A>>

export type Equality<A> = (lhs: A, rhs: A) => boolean

// Unification
export function unify<A>(lhs: Term<A>, rhs: Term<A>, env: ConstraintSet<A>, eq: Equality<A> = (a, b) => a === b): Stream<ConstraintSet<A>> {
	if (lhs.tag === 'const' && rhs.tag === 'const') {
		if (eq(lhs.const, rhs.const)) return singleton(env)
		return empty()
	}

	if (lhs.tag === 'var') {
		return singleton([...env, { tag: 'eq', lhs, rhs }])
	} else if (rhs.tag === 'var') {
		return singleton([...env, { tag: 'eq', lhs: rhs, rhs: lhs }])
	}

	if (lhs.tag === 'seq' && rhs.tag === 'seq') {
		if (lhs.seq.length !== rhs.seq.length) return empty()
		return lhs.seq.reduce((acc, t, i) => bind(acc, (env) => unify(t, rhs.seq[i], env, eq)), singleton(env))
	}

	if (lhs.tag === 'set' && rhs.tag === 'set') {
		if (lhs.set.length !== rhs.set.length) return empty()
		if (lhs.set.length === 0) return singleton(env)
		if (lhs.set.length === 1) return unify(lhs.set[0], rhs.set[0], env, eq)

		const [head, ...tail] = lhs.set
		return merge(...rhs.set.map((t, i) => {
			const match = unify(head, t, env, eq)
			return bind(match, (env) => unify({ tag: 'set', set: tail }, { tag: 'set', set: rhs.set.slice(0, i).concat(rhs.set.slice(i + 1)) }, env, eq))
		}))
	}

	return empty()
}

export function eq<A>(lhs: Term<A>, rhs: Term<A>, eq: Equality<A> = (a, b) => a === b): Goal<A> {
	return (state) => {
		const match = unify(lhs, rhs, state.constraints, eq)
		return map(match, (constraints) => ({ ...state, constraints }))
	}
}

export function conj<A>(...goals: Goal<A>[]): Goal<A> {
	return (state) => goals.reduce((acc, g) => bind(acc, g), singleton(state))
}

export function disj<A>(...goals: Goal<A>[]): Goal<A> {
	return (state) => merge(...goals.map((g) => g(state)))
}

export function fresh<A>(f: (...args: Term<A>[]) => Goal<A>): Goal<A> {
	return (state) => {
		const args: Term<A>[] = [...new Array(f.length)].map((_, i) => ({ tag: 'var', var: `v${state.nextVar + i}` }))
		return f(...args)({ ...state, nextVar: state.nextVar + args.length })
	}
}

export function conde<A>(...cases: Goal<A>[][]): Goal<A> {
	return disj(...cases.map((goals) => conj(...goals)))
}

export function run<A>(goal: Goal<A>, state: State<A> = init()): Stream<State<A>> {
	return goal(state)
}
