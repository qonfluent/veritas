import assert from "assert"

export enum TermTag {
	Free,
	Local,
	Meta,
	Universe,
	Apply,
	Lambda,
	Pi,
}

export type FreeId = number
export type VarId = number
export type MetaId = number

export type Term
	= [TermTag.Free, FreeId]
	| [TermTag.Local, VarId]
	| [TermTag.Meta, MetaId]
	| [TermTag.Universe]
	| [TermTag.Apply, Term, Term]
	| [TermTag.Lambda, Term]
	| [TermTag.Pi, Term, Term]

export function equals(a: Term, b: Term): boolean {
	if (a[0] !== b[0]) return false

	switch (a[0]) {
		case TermTag.Free:
		case TermTag.Local:
		case TermTag.Meta: {
			return a[1] === b[1]
		}
		case TermTag.Universe: {
			return true
		}
		case TermTag.Apply:
		case TermTag.Pi: {
			assert(b[0] === a[0])
			return equals(a[1], b[1]) && equals(a[2], b[2])
		}
		case TermTag.Lambda: {
			assert(b[0] === a[0])
			return equals(a[1], b[1])
		}
	}
}

export function raise(levels: number, term: Term): Term {
	function go(lower, i, t) {
		switch (t[0]) {
			case TermTag.Local: {
				if (t[1] < lower) return t
				return [TermTag.Local, t[1] + i]
			}
			case TermTag.Apply: {
				return [TermTag.Apply, go(lower, i, t[1]), go(lower, i, t[2])]
			}
			case TermTag.Lambda: {
				return [TermTag.Lambda, go(lower + 1, i, t[1])]
			}
			case TermTag.Pi: {
				return [TermTag.Pi, go(lower, i, t[1]), go(lower + 1, i, t[2])]
			}
			default: {
				return t
			}
		}
	}

	return go(0, levels, term)
}

export function subst(base: Term, value: Term, variable: VarId): Term {
	switch (base[0]) {
		case TermTag.Local: {
			if (base[1] === variable) return value
			return base
		}
		case TermTag.Apply: {
			return [TermTag.Apply, subst(base[1], value, variable), subst(base[2], value, variable)]
		}
		case TermTag.Lambda: {
			return [TermTag.Lambda, subst(base[1], raise(1, value), variable + 1)]
		}
		case TermTag.Pi: {
			return [TermTag.Pi, subst(base[1], value, variable), subst(base[2], raise(1, value), variable + 1)]
		}
		default: {
			return base
		}
	}
}

export function substMeta(base: Term, value: Term, variable: MetaId): Term {
	switch (base[0]) {
		case TermTag.Meta: {
			if (base[1] === variable) return value
			return base
		}
		case TermTag.Apply: {
			return [TermTag.Apply, substMeta(base[1], value, variable), substMeta(base[2], value, variable)]
		}
		case TermTag.Lambda: {
			return [TermTag.Lambda, substMeta(base[1], raise(1, value), variable)]
		}
		case TermTag.Pi: {
			return [TermTag.Pi, substMeta(base[1], value, variable), substMeta(base[2], raise(1, value), variable)]
		}
		default: {
			return base
		}
	}
}

export function getMetavars(term: Term): Set<MetaId> {
	switch (term[0]) {
		case TermTag.Meta: {
			return new Set([term[1]])
		}
		case TermTag.Apply: {
			const a = getMetavars(term[1])
			const b = getMetavars(term[2])
			a.forEach(x => b.add(x))
			return b
		}
		case TermTag.Lambda: {
			return getMetavars(term[1])
		}
		case TermTag.Pi: {
			const a = getMetavars(term[1])
			const b = getMetavars(term[2])
			a.forEach(x => b.add(x))
			return b
		}
		default: {
			return new Set()
		}
	}
}

export function isClosed(term: Term): boolean {
	switch (term[0]) {
		case TermTag.Free: return false
		case TermTag.Local: return true
		case TermTag.Meta: return true
		case TermTag.Universe: return true
		case TermTag.Apply: return isClosed(term[1]) && isClosed(term[2])
		case TermTag.Lambda: return isClosed(term[1])
		case TermTag.Pi: return isClosed(term[1]) && isClosed(term[2])
	}
}

export function reduce(term: Term): Term {
	switch (term[0]) {
		case TermTag.Apply: {
			const a = reduce(term[1])
			if (a[0] === TermTag.Lambda) {
				return reduce(subst(a[1], term[2], 0))
			}

			return [TermTag.Apply, a, reduce(term[2])]
		}
		case TermTag.Lambda: {
			return [TermTag.Lambda, reduce(term[1])]
		}
		case TermTag.Pi: {
			return [TermTag.Pi, reduce(term[1]), reduce(term[2])]
		}
		default: {
			return term
		}
	}
}

export function isStuck(term: Term): boolean {
	switch (term[0]) {
		case TermTag.Meta: return true
		case TermTag.Apply: return isStuck(term[1])
		default: return false
	}
}

export function peelApply(term: Term): [Term, Term[]] {
	const args: Term[] = []
	while (term[0] === TermTag.Apply) {
		args.push(term[2])
		term = term[1]
	}
	return [term, args]
}

export function unpeelApply(term: Term, args: Term[]): Term {
	for (let i = args.length - 1; i >= 0; i--) {
		term = [TermTag.Apply, term, args[i]]
	}

	return term
}

export type Constraint = [Term, Term]

let nextVarId = 0
export function genVar(): FreeId | MetaId {
	return nextVarId++
}

export function simplify(con: Constraint): Set<Constraint> | undefined {
	if (equals(con[0], con[1])) return new Set()

	const reducedLhs = reduce(con[0])
	if (!equals(reducedLhs, con[0])) return simplify([reducedLhs, con[1]])

	const reducedRhs = reduce(con[1])
	if (!equals(reducedRhs, con[1])) return simplify([con[0], reducedRhs])

	const [lhsFV, lhsArgs] = peelApply(con[0])
	const [rhsFV, rhsArgs] = peelApply(con[1])
	if (lhsFV[0] === TermTag.Free && rhsFV[0] === TermTag.Free && lhsFV[1] === rhsFV[1]) {
		if (lhsArgs.length !== rhsArgs.length) return new Set()
		if (lhsFV[1] !== rhsFV[1]) return new Set()

		const newArgs = lhsArgs.map((lhs, i) => simplify([lhs, rhsArgs[i]]))
		const newConstraints = new Set<Constraint>()
		for (const arg of newArgs) {
			if (arg === undefined) return undefined
			arg.forEach(x => newConstraints.add(x))
		}

		return newConstraints
	}

	if (con[0][0] === TermTag.Lambda && con[1][0] === TermTag.Lambda) {
		const v: Term = [TermTag.Free, genVar()]
		return new Set([[subst(con[0][1], v, 0), subst(con[1][1], v, 0)]])
	}

	if (con[0][0] === TermTag.Pi && con[1][0] === TermTag.Pi) {
		const v: Term = [TermTag.Free, genVar()]
		return new Set([
			[subst(con[0][2], v, 0), subst(con[1][2], v, 0)],
			[con[0][1], con[1][1]],
		])
	}

	if (isStuck(con[0]) || isStuck(con[1])) return new Set([con])

	return undefined
}

export type Subst = Map<MetaId, Term>

export function tryFlexRigid(con: Constraint): () => Subst[] {
	function generateSubst(bvars: number, metavar: MetaId, f: Term, nargs: number): Subst[] {
		const metas: Term[] = [...new Array(nargs)].map(() => [TermTag.Meta, genVar()])
		const locals: Term[] = [...new Array(bvars)].map((_, i) => [TermTag.Local, i])
		const args = metas.map((tm) => locals.reduce((acc, tm) => [TermTag.Apply, tm, acc], tm))
		const results = locals.concat(isClosed(f) ? [f] : []).map((t) => {
			const unpeeled = unpeelApply(t, args)
			const lambda = [...new Array(bvars)].reduce((acc) => [TermTag.Lambda, acc], unpeeled)
			const result = new Map([[metavar, lambda]])
			return result
		})

		return results
	}

	function proj(bvars: number, metavar: MetaId, f: Term): (() => Subst[]) {
		let nargs = 0
		return () => {
			return generateSubst(bvars, metavar, f, nargs++)
		}
	}

	const [lhsF, lhsArgs] = peelApply(con[0])
	const [rhsF, rhsArgs] = peelApply(con[1])

	const lhsMetas = getMetavars(con[1])
	const rhsMetas = getMetavars(con[0])

	if (lhsF[0] === TermTag.Meta && !rhsMetas.has(lhsF[1])) {
		return proj(lhsArgs.length, lhsF[1], rhsF)
	}

	if (rhsF[0] === TermTag.Meta && !lhsMetas.has(rhsF[1])) {
		return proj(rhsArgs.length, rhsF[1], lhsF)
	}

	return () => []
}

export function fullySimplify(constraints: Set<Constraint>): Set<Constraint> {
	while(true) {
		const newConstraints = new Set<Constraint>()
		constraints.forEach((con) => {
			const simplified = simplify(con)
			if (!simplified) {
				throw new Error(`Could not simplify constraint ${JSON.stringify(con[0]) + ' = ' + JSON.stringify(con[1])} (in ${[...constraints].map(([lhs, rhs]) => JSON.stringify(lhs) + ' = ' + JSON.stringify(rhs)).join(", ")})`)
			}

			simplified.forEach((x) => newConstraints.add(x))
		})

		if (newConstraints.size === constraints.size) {
			if ([...constraints].every((x) => [...newConstraints].find((y) => equals(x[0], y[0]) && equals(x[1], y[1]) !== undefined))) {
				return constraints
			}
		}
	}
}

export function manySubst(substs: Subst, term: Term): Term {
	let result = term
	substs.forEach((v, k) => {
		result = subst(result, v, k)
	})

	return result
}

export function mergeSubsts(lhs: Subst, rhs: Subst): Subst | undefined {
	const result = new Map(lhs)
	for (const [k, v] of rhs) {
		const current = result.get(k)
		if (current) {
			throw new Error(`Cannot merge subst ${lhs} and ${rhs} because ${k} is bound to both ${current} and ${v}`)
		}

		result.set(k, v)
	}

	return result
}

export function partition<T>(pred: (x: T) => boolean, xs: Set<T>): [Set<T>, Set<T>] {
	const lhs = new Set<T>()
	const rhs = new Set<T>()
	xs.forEach((x) => (pred(x) ? lhs : rhs).add(x))
	return [lhs, rhs]
}

export type UnifyResult = () => [Subst, Set<Constraint>] | undefined

export function unify(subst: Subst, constraints: Set<Constraint>): UnifyResult {
	function applySubst(subst: Subst, constraints: Set<Constraint>): Set<Constraint> {
		const result = new Set<Constraint>()
		constraints.forEach(([lhs, rhs]) => {
			result.add([manySubst(subst, lhs), manySubst(subst, rhs)])
		})

		return result
	}

	function trySubsts(substs: () => Subst[], constraints: Set<Constraint>): UnifyResult {
		const sub = substs()
		if (sub.length === 0) return () => undefined

		let unifiedIndex = 0
		const unifieds = () => {
			for (let i = unifiedIndex; i < sub.length; i++) {
				const unified = unify(sub[i], constraints)
				if (unified) {
					unifiedIndex = i + 1
					return unified
				}
			}

			return () => undefined
		}

		let cycleCount = 0
		const buffer: UnifyResult[] = []
		const interleaved = () => {
			if (cycleCount === buffer.length) {
				cycleCount = 0
				const unified = unifieds()
				buffer.push(unified)
				const result = unified()
				if (result === undefined) {
					throw new Error(`Unification failed in interleaving (1)`)
				}

				return result
			}

			const result = buffer[cycleCount]()
			if (result === undefined) {
				throw new Error(`Unification failed in interleaving (2)`)
			}

			cycleCount++
			return result
		}

		return interleaved
	}

	const [flexFlexes, flexRigids] =  partition(([lhs, rhs]) => isStuck(lhs) && isStuck(rhs), fullySimplify(applySubst(subst, constraints)))
	if (flexRigids.size === 0) {
		let called = false
		return () => {
			if (called) return undefined
			called = true
			return [subst, flexFlexes]
		}
	}

	const selected = ((x) => x[Math.floor(Math.random() * x.length)])([...flexRigids])
	const partSubsts = tryFlexRigid(selected)
	return trySubsts(partSubsts, new Set([...flexFlexes, ...flexRigids]))
}


describe('unification', () => {
	it('Can unify Universe', () => {
		const constraints = new Set<Constraint>([
			[[TermTag.Meta, 0], [TermTag.Universe]],
		])

		const result = unify(new Map(), constraints)()
		console.log(result)
	})
})
