import { rangeMap } from '../Utilities'
import { Env, Term, Tag } from './AST'
import { Stream, bind, singleton, merge } from './Stream'
import { getUnifiers } from './Unifiers'

export type State = { env: Env, free: number }
export type Goal = (state: State) => Stream<State>

export function conj(...goals: Goal[]): Goal {
	return (state) => {
		return goals.reduce((stream, goal) => bind(stream, goal), singleton(state))
	}
}

export function disj(...goals: Goal[]): Goal {
	return (state) => {
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
	if (term[0] !== Tag.Var) return term
	const value = state.env.get(term[1])
	if (value === undefined) return term
	return walk(value, state)
}

export function eq(lhs: Term, rhs: Term): Goal {
	const unifiers = getUnifiers()
	return (state) => {
		lhs = walk(lhs, state)
		rhs = walk(rhs, state)
		const unifier = unifiers[lhs[0]][rhs[0]]
		const result = unifier(lhs, rhs)
		return result(state)
	}
}
