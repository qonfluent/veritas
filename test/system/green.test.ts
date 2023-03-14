export type Term = unknown
export type Env = Record<symbol, Term>

export function unify(env: Env, lhs: Term, rhs: Term): Env | Error {
	function walk(term: Term, env: Env): Term {
		return typeof term === 'symbol' && term in env ? walk(env[term], env) : term
	}

	lhs = walk(lhs, env)
	rhs = walk(rhs, env)

	if (lhs === rhs) {
		return env
	} else if (lhs instanceof Uint8Array && rhs instanceof Uint8Array) {
		return Buffer.compare(lhs, rhs) === 0 ? env : new Error(`Cannot unify ${lhs} with ${rhs}`)
	} else if (typeof lhs === 'symbol') {
		return { ...env, [lhs]: rhs }
	} else if (typeof rhs === 'symbol') {
		return { ...env, [rhs]: lhs }
	} else if (Array.isArray(lhs) && Array.isArray(rhs)) {
		if (lhs.length !== rhs.length) {
			return new Error(`Cannot unify ${lhs} with ${rhs} (length mismatch)\nExpected ${lhs.length}, but got ${rhs.length}`)
		}

		for (let i = 0; i < lhs.length; i++) {
			const result = unify(env, lhs[i], rhs[i])
			if (result instanceof Error) {
				return result
			}

			env = result
		}

		return env
	} else {
		return new Error(`Cannot unify ${JSON.stringify(lhs)} with ${JSON.stringify(rhs)}`)
	}
}

export type Stream<A> = { head: A[], tail?: () => Stream<A> }

export function concat<A>(...streams: Stream<A>[]): Stream<A> {
	const head = streams.flatMap((s) => s.head)
	const tails = streams.flatMap((s) => s.tail ?? [])
	return { head, tail: () => concat(...tails.map((t) => t())) }
}

export function flatMap<A>(stream: Stream<A>, f: (a: A) => Stream<A>): Stream<A> {
	return concat(...stream.head.map(f), stream.tail ? flatMap(stream.tail(), f) : { head: [] })
}

export type State = { env: Env, fresh: number }
export type Goal = (state: State) => Stream<State>

export function run(count: number, goal: Goal): State[] {
	const results: State[] = []
	let stream = goal({ env: {}, fresh: 0 })

	while (results.length < count && stream.head.length > 0) {
		results.push(...stream.head)
		stream = stream.tail ? stream.tail() : { head: [] }
	}

	return results.slice(0, count)
}

export function eq(lhs: Term, rhs: Term): Goal {
	return (state) => {
		const result = unify(state.env, lhs, rhs)
		if (result instanceof Error) {
			return { head: [] }
		}

		return { head: [{ ...state, env: result }] }
	}
}

export function fresh(f: (...vars: Term[]) => Goal): Goal {
	return (state) => {
		const vars = Array.from({ length: f.length }, () => Symbol(state.fresh++))
		return f(...vars)(state)
	}
}

export function conj(...goals: Goal[]): Goal {
	return (state) => {
		let stream: Stream<State> = { head: [state] }
		for (const goal of goals) {
			stream = flatMap(stream, goal)
		}

		return stream
	}
}

export function disj(...goals: Goal[]): Goal {
	return (state) => {
		let stream: Stream<State> = { head: [] }
		for (const goal of goals) {
			stream = concat(stream, goal(state))
		}

		return stream
	}
}
