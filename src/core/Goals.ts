import { rangeMap } from '../Utilities'
import { Term, Tag, Var } from './AST'
import { Stream, bind, singleton, merge, empty } from './Stream'
import { getUnifiers } from './Unifiers'

export type Env = Record<Var, Term>
export type State = { env: Env, free: number }
export type Goal = (state: State) => Stream<State>

export function conj(...goals: Goal[]): Goal {
	return (state) => {
		return goals.reduce((stream, goal) => bind(stream, goal), singleton(state))
	}
}

export function disj(...goals: Goal[]): Goal {
	return (state) => {
		if (goals.length === 0) return empty()
		return merge(...goals.map((goal) => goal(state)))
	}
}

export function exists(f: (...args: Term[]) => Goal): Goal {
	return (state) => {
		const vars: Term[] = rangeMap(f.length, (i) => [Tag.Var, `@gensym(${i})`])
		return f(...vars)({ ...state, free: state.free + f.length })
	}
}

function walk(term: Term, state: State): Term {
	if (term[0] === Tag.Var) {
		const value = state.env[term[1]]
		if (value) return walk(value, state)
	}
	return term
}

export function eq(lhs: Term, rhs: Term): Goal {
	const unifiers = getUnifiers()
	return (state) => {
		lhs = walk(lhs, state)
		rhs = walk(rhs, state)
		return unifiers[lhs[0]][rhs[0]](lhs, rhs)(state)
	}
}
