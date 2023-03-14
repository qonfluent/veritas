import assert from "assert"

export type Term
	= { var: number }
	| { meta: number }
	| { lam: Term }
	| { pi: Term, body: Term }
	| { app: Term, to: Term }

export function raise(depth: number, term: Term): Term {
	function go(lower: number, depth: number, term: Term): Term {
		if ('var' in term) {
			return term.var <= lower ? term : { var: term.var + depth }
		} else if ('lam' in term) {
			return { lam: go(lower + 1, depth, term.lam) }
		} else if ('app' in term) {
			return { app: go(lower, depth, term.app), to: go(lower, depth, term.to) }
		} else if ('pi' in term) {
			return { pi: go(lower, depth, term.pi), body: go(lower + 1, depth, term.body) }
		} else {
			return term
		}
	}

	return go(0, depth, term)
}

export function substitute(newVal: Term, depth: number, term: Term): Term {
	if ('free' in term || 'meta' in term) {
		return term
	} else if ('var' in term) {
		return term.var < depth ? term : term.var === depth ? newVal : { var: term.var - 1 }
	} else if ('lam' in term) {
		return { lam: substitute(raise(1, newVal), depth + 1, term.lam) }
	} else if ('app' in term) {
		return { app: substitute(newVal, depth, term.app), to: substitute(newVal, depth, term.to) }
	} else if ('pi' in term) {
		return { pi: substitute(newVal, depth, term.pi), body: substitute(raise(1, newVal), depth + 1, term.body) }
	} else {
		throw new Error('unreachable')
	}
}

export function substituteMV(newVal: Term, name: number, term: Term): Term {
	if ('meta' in term) {
		return term.meta === name ? newVal : term
	} else if ('lam' in term) {
		return { lam: substituteMV(raise(1, newVal), name, term.lam) }
	} else if ('app' in term) {
		return { app: substituteMV(newVal, name, term.app), to: substituteMV(newVal, name, term.to) }
	} else if ('pi' in term) {
		return { pi: substituteMV(newVal, name, term.pi), body: substituteMV(raise(1, newVal), name, term.body) }
	} else {
		return term
	}
}

export function metavars(term: Term): number[] {
	if ('free' in term || 'var' in term) {
		return []
	} else if ('meta' in term) {
		return [term.meta]
	} else if ('lam' in term) {
		return metavars(term.lam)
	} else if ('app' in term) {
		return [...metavars(term.app), ...metavars(term.to)]
	} else if ('pi' in term) {
		return [...metavars(term.pi), ...metavars(term.body)]
	} else {
		throw new Error('unreachable')
	}
}

export function isClosed(term: Term): boolean {
	if ('free' in term) {
		return false
	} else if ('var' in term || 'meta' in term) {
		return true
	} else if ('lam' in term) {
		return isClosed(term.lam)
	} else if ('app' in term) {
		return isClosed(term.app) && isClosed(term.to)
	} else if ('pi' in term) {
		return isClosed(term.pi) && isClosed(term.body)
	} else {
		throw new Error('unreachable')
	}
}

export function reduce(term: Term): Term {
	if ('lam' in term) {
		return { lam: reduce(term.lam) }
	} else if ('app' in term) {
		const f = reduce(term.app)
		if ('lam' in f) {
			return reduce(substitute(term.to, 0, f.lam))
		} else {
			return { app: f, to: reduce(term.to) }
		}
	} else if ('pi' in term) {
		return { pi: reduce(term.pi), body: reduce(term.body) }
	} else {
		return term
	}
}

export function isStuck(term: Term): boolean {
	if ('meta' in term) {
		return true
	} else if ('app' in term) {
		return isStuck(term.app)
	} else {
		return false
	}
}

export function peelTele(term: Term): [Term, Term[]] {
	function go(term: Term, rest: Term[]): [Term, Term[]] {
		if ('app' in term) {
			return go(term.app, [term.to].concat(rest))
		} else {
			return [term, rest]
		}
	}

	return go(term, [])
}

export function applyTele(term: Term, args: Term[]): Term {
	return args.reduce((acc, arg) => ({ app: acc, to: arg }), term)
}

export type Constraint = [Term, Term]

export function equal(lhs: Term, rhs: Term): boolean {
	if ('var' in lhs && 'var' in rhs) {
		return lhs.var === rhs.var
	} else if ('meta' in lhs && 'meta' in rhs) {
		return lhs.meta === rhs.meta
	} else if ('free' in lhs && 'free' in rhs) {
		return lhs.free === rhs.free
	} else if ('lam' in lhs && 'lam' in rhs) {
		return equal(lhs.lam, rhs.lam)
	} else if ('app' in lhs && 'app' in rhs) {
		return equal(lhs.app, rhs.app) && equal(lhs.to, rhs.to)
	} else if ('pi' in lhs && 'pi' in rhs) {
		return equal(lhs.pi, rhs.pi) && equal(lhs.body, rhs.body)
	} else {
		return false
	}
}

export function show(term: Term): string {
	if ('var' in term) {
		return `_${term.var}`
	} else if ('meta' in term) {
		return `m${term.meta}`
	} else if ('free' in term) {
		return `f${term.free}`
	} else if ('lam' in term) {
		return `λ ${show(term.lam)}`
	} else if ('app' in term) {
		return `(${show(term.app)} ${show(term.to)})`
	} else if ('pi' in term) {
		return `(${show(term.pi)} → ${show(term.body)})`
	} else {
		throw new Error('unreachable')
	}
}

export type Subst = (Term | undefined)[]
export type State = [Constraint[], Subst, number]

export function simplify([lhs, rhs]: Constraint, subst: Subst, free: number): State | undefined {
	if (equal(lhs, rhs) && metavars(lhs).length === 0) {
		return [[], subst, free]
	}

	const redLHS = reduce(lhs)
	if (!equal(redLHS, lhs)) {
		return simplify([redLHS, rhs], subst, free)
	}

	const redRHS = reduce(rhs)
	if (!equal(redRHS, rhs)) {
		return simplify([lhs, redRHS], subst, free)
	}

	const [lhsFV, lhsArgs] = peelTele(lhs)
	const [rhsFV, rhsArgs] = peelTele(rhs)
	if ('free' in lhsFV && 'free' in rhsFV) {
		if (lhsFV.free === rhsFV.free && lhsArgs.length === rhsArgs.length) {
			const simplified: Constraint[] = []
			for (let i = 0; i < lhsArgs.length; i++) {
				const result = simplify([lhsArgs[i], rhsArgs[i]], subst, free)
				if (result === undefined) {
					return undefined
				}

				const [constraints, newSubst] = result
				simplified.push(...constraints)
				subst = newSubst
			}

			return [simplified, subst, free]
		}

		return undefined
	} else if ('lam' in lhs && 'lam' in rhs) {
		const v = { var: free++ }
		subst.push(v)
		return [[[substitute(v, 0, lhs.lam), substitute(v, 0, rhs.lam)]], subst, free]
	} else if ('pi' in lhs && 'pi' in rhs) {
		const v = { var: free++ }
		return [
			[
				[substitute(v, 0, lhs.pi), substitute(v, 0, rhs.pi)],
				[lhs.body, rhs.body],
			],
			subst,
			free,
		]
	} else {
		if (isStuck(lhs) || isStuck(rhs)) {
			return [[[lhs, rhs]], subst, free]
		}

		return undefined
	}
}

export type StateStream = { head: State[], tail?: () => StateStream }

export function tryFlexRigid([lhs, rhs]: Constraint, subst: Subst, free: number): StateStream {
	function generateSubst(bvars: number, mv: number, f: Term, nargs: number): State[] {
		const mkLam = (tm: Term): Term => new Array(bvars).reduceRight((acc, _) => ({ lam: acc }), tm)
		const saturateMV = (tm: Term): Term => new Array(bvars).reduce((acc, _, i) => ({ app: acc, to: { var: i } }), tm)
		
		const args = new Array(nargs).map(() => saturateMV({ meta: free++ }))
		const terms = new Array(bvars).map((_, i): Term => ({ var: i })).concat(isClosed(f) ? [f] : [])
		const results = terms.map((tm) => {
			const result = subst.slice()
			result[mv] = mkLam(applyTele(tm, args))
			return result
		})

		return results.map((result) => [[], result, free])
	}

	function proj(bvars: number, mv: number, f: Term, nargs: number): StateStream {
		return { head: generateSubst(bvars, mv, f, nargs), tail: () => proj(bvars, mv, f, nargs + 1) }
	}

	const [lhsTerm, lhsArgs] = peelTele(lhs)
	const [rhsTerm, rhsArgs] = peelTele(rhs)

	if ('meta' in lhsTerm && !metavars(rhs).includes(lhsTerm.meta)) {
		return proj(lhsArgs.length, lhsTerm.meta, rhsTerm, 0)
	} else if ('meta' in rhsTerm && !metavars(lhs).includes(rhsTerm.meta)) {
		return proj(rhsArgs.length, rhsTerm.meta, lhsTerm, 0)
	} else {
		return { head: [] }
	}
}

describe('Raise', () => {
	it('Should raise a variable term', () => {
		const term = raise(1, { var: 1 })
		expect(term).toEqual({ var: 2 })
	})
	
	it('Should raise a meta term', () => {
		const term = raise(1, { meta: 5 })
		expect(term).toEqual({ meta: 5 })
	})

	it('Should raise a free term', () => {
		const term = raise(1, { free: 5 })
		expect(term).toEqual({ free: 5 })
	})

	it('Should raise a lambda term', () => {
		const term = raise(1, { lam: { var: 0 } })
		expect(term).toEqual({ lam: { var: 0 } })
	})

	it('Should raise an application term', () => {
		const term = raise(1, { app: { var: 1 }, to: { var: 1 } })
		expect(term).toEqual({ app: { var: 2 }, to: { var: 2 } })
	})

	it('Should raise a complex term', () => {
		const term = raise(1, { app: { lam: { var: 0 } }, to: { var: 1 } })
		expect(term).toEqual({ app: { lam: { var: 0 } }, to: { var: 2 } })
	})
})

describe('Substitution', () => {
	it('Should substitute in a variable term', () => {
		const newVal = { meta: 5 }
		const result = substitute(newVal, 0, { var: 0 })
		expect(result).toEqual(newVal)
	})

	it('Should substitute in a meta term', () => {
		const newVal = { meta: 5 }
		const result = substitute(newVal, 0, { meta: 5 })
		expect(result).toEqual(newVal)
	})

	it('Should substitute in a free term', () => {
		const newVal = { meta: 5 }
		const result = substitute(newVal, 0, { free: 5 })
		expect(result).toEqual({ free: 5 })
	})

	it('Should substitute in a lambda term', () => {
		const newVal = { meta: 5 }
		const result = substitute(newVal, 0, { lam: { var: 0 } })
		expect(result).toEqual({ lam: { var: 0 } })
	})

	it('Should substitute in an application term', () => {
		const newVal = { meta: 5 }
		const result = substitute(newVal, 0, { app: { var: 0 }, to: { var: 0 } })
		expect(result).toEqual({ app: newVal, to: newVal })
	})

	it('Should substitute in a complex term', () => {
		const newVal = { meta: 5 }
		const result = substitute(newVal, 0, { app: { lam: { var: 0 } }, to: { var: 0 } })
		expect(result).toEqual({ app: { lam: { var: 0 } }, to: newVal })
	})
})

describe('Metavariable substitution', () => {
	it('Should substitute in a variable term', () => {
		const newVal = { meta: 5 }
		const result = substituteMV(newVal, 5, { var: 0 })
		expect(result).toEqual({ var: 0 })
	})

	it('Should substitute in a meta term', () => {
		const newVal = { meta: 5 }
		const result = substituteMV(newVal, 5, { meta: 5 })
		expect(result).toEqual(newVal)
	})

	it('Should substitute in a free term', () => {
		const newVal = { meta: 5 }
		const result = substituteMV(newVal, 5, { free: 5 })
		expect(result).toEqual({ free: 5 })
	})

	it('Should substitute in a lambda term', () => {
		const newVal = { meta: 5 }
		const result = substituteMV(newVal, 5, { lam: { var: 0 } })
		expect(result).toEqual({ lam: { var: 0 } })
	})

	it('Should substitute in an application term', () => {
		const newVal = { meta: 5 }
		const result = substituteMV(newVal, 5, { app: { var: 0 }, to: { meta: 5 } })
		expect(result).toEqual({ app: { var: 0 }, to: newVal })
	})

	it('Should substitute in a complex term', () => {
		const newVal = { meta: 5 }
		const result = substituteMV(newVal, 5, { app: { lam: { lam: { meta: 5 } } }, to: { var: 0 } })
		expect(result).toEqual({ app: { lam: { lam: newVal } }, to: { var: 0 } })
	})
})

describe('Metavariables', () => {
	it('Should collect term metavariables', () => {
		const term = { app: { lam: { lam: { meta: 5 } } }, to: { var: 0 } }
		const result = metavars(term)
		expect(result).toEqual([5])
	})

	it('Should collect many term metavariables', () => {
		const term = { app: { lam: { lam: { meta: 5 } } }, to: { meta: 6 } }
		const result = metavars(term)
		expect(result).toEqual([5, 6])
	})
})

describe('Free variables', () => {
	it('Can detect open terms', () => {
		const term = { app: { lam: { lam: { free: 5 } } }, to: { var: 0 } }
		expect(isClosed(term)).toBe(false)
	})

	it('Can detect closed terms', () => {
		const term = { app: { lam: { lam: { var: 0 } } }, to: { var: 0 } }
		expect(isClosed(term)).toBe(true)
	})
})

describe('Reduce', () => {
	it('Can reduce free variables', () => {
		const term = { free: 5 }
		const result = reduce(term)
		expect(result).toEqual(term)
	})

	it('Can reduce meta variables', () => {
		const term = { meta: 5 }
		const result = reduce(term)
		expect(result).toEqual(term)
	})

	it('Can reduce variables', () => {
		const term = { var: 0 }
		const result = reduce(term)
		expect(result).toEqual(term)
	})

	it('Can reduce simple lambdas', () => {
		const term = { lam: { var: 0 } }
		const result = reduce(term)
		expect(result).toEqual(term)
	})

	it('Can reduce complex lambdas', () => {
		const term = { lam: { app: { meta: 5 }, to: { meta: 6 } } }
		const result = reduce(term)
		expect(result).toEqual(term)
	})

	it('Can reduce applications', () => {
		const term = { app: { lam: { var: 0 } }, to: { meta: 5 } }
		const result = reduce(term)
		expect(result).toEqual({ meta: 5 })
	})
})

describe('Stuckness', () => {
	it('Can detect a stuck term', () => {
		const term = { meta: 5 }
		expect(isStuck(term)).toBe(true)
	})

	it('Can detect a non-stuck term', () => {
		const term = { app: { lam: { var: 0 } }, to: { var: 0 } }
		expect(isStuck(term)).toBe(false)
	})
})

describe('Telescope peeling and unpeeling', () => {
	it('Can peel a telescope', () => {
		const result = peelTele({ app: { lam: { var: 0 } }, to: { meta: 5 } })
		expect(result).toEqual([{ lam: { var: 0 } }, [{ meta: 5 }]])
	})

	it('Can apply a telescope', () => {
		const result = applyTele({ lam: { var: 0 } }, [{ meta: 5 }])
		expect(result).toEqual({ app: { lam: { var: 0 } }, to: { meta: 5 } })
	})

	it('Can peel and apply a deep telescope', () => {
		const term = { app: { app: { lam: { lam: { var: 0 } } }, to: { meta: 5 } }, to: { meta: 6 } }
		const peeled = peelTele(term)
		expect(peeled).toEqual([{ lam: { lam: { var: 0 } } }, [{ meta: 5 }, { meta: 6 }]])

		const applied = applyTele(peeled[0], peeled[1])
		expect(applied).toEqual(term)
	})
})

describe('Term equality', () => {
	it('Should detect equal free terms', () => {
		const term = { free: 5 }
		expect(equal(term, term)).toBe(true)
	})

	it('Should detect equal meta terms', () => {
		const term = { meta: 5 }
		expect(equal(term, term)).toBe(true)
	})

	it('Should detect equal variable terms', () => {
		const term = { var: 0 }
		expect(equal(term, term)).toBe(true)
	})

	it('Should detect equal lambda terms', () => {
		const term = { lam: { var: 0 } }
		expect(equal(term, term)).toBe(true)
	})

	it('Should detect equal application terms', () => {
		const term = { app: { lam: { var: 0 } }, to: { var: 0 } }
		expect(equal(term, term)).toBe(true)
	})

	it('Should detect unequal free terms', () => {
		const term = { free: 5 }
		const other = { free: 6 }
		expect(equal(term, other)).toBe(false)
	})

	it('Should detect unequal meta terms', () => {
		const term = { meta: 5 }
		const other = { meta: 6 }
		expect(equal(term, other)).toBe(false)
	})

	it('Should detect unequal variable terms', () => {
		const term = { var: 0 }
		const other = { var: 1 }
		expect(equal(term, other)).toBe(false)
	})

	it('Should detect unequal lambda terms', () => {
		const term = { lam: { var: 0 } }
		const other = { lam: { var: 1 } }
		expect(equal(term, other)).toBe(false)
	})

	it('Should detect unequal application terms', () => {
		const term = { app: { lam: { var: 0 } }, to: { var: 0 } }
		const other = { app: { lam: { var: 1 } }, to: { var: 1 } }
		expect(equal(term, other)).toBe(false)
	})
})

describe('Show term', () => {
	it('Can show a free term', () => {
		const term = { free: 5 }
		const result = show(term)
		expect(result).toEqual('f5')
	})

	it('Can show a meta term', () => {
		const term = { meta: 5 }
		const result = show(term)
		expect(result).toEqual('m5')
	})

	it('Can show a variable term', () => {
		const term = { var: 0 }
		const result = show(term)
		expect(result).toEqual('_0')
	})

	it('Can show a lambda term', () => {
		const term = { lam: { var: 0 } }
		const result = show(term)
		expect(result).toEqual('λ _0')
	})

	it('Can show a complex lambda term', () => {
		const term = { lam: { lam: { var: 1 } } }
		const result = show(term)
		expect(result).toEqual('λ λ _1')
	})
})

describe('Simplification of constraints', () => {
	it('Can simplify an equal constraint with no metavars', () => {
		const result = simplify([{ var: 0 }, { var: 0 }], [], 0)
		expect(result).toEqual([[], [], 0])
	})

	it('Can simplify an equal constraint with metavar', () => {
		const result = simplify([{ var: 0 }, { meta: 5 }], [], 0)
		expect(result).toEqual([[[{ var: 0 }, { meta: 5 }]], [], 0])
	})

	it('Can simplify reductions on the lhs', () => {
		const result = simplify([{ app: { lam: { var: 0 } }, to: { meta: 2 } }, { meta: 5 }], [], 0)
		expect(result).toEqual([[[{ meta: 2 }, { meta: 5 }]], [], 0])
	})

	it('Can simplify reductions on the rhs', () => {
		const result = simplify([{ meta: 5 }, { app: { lam: { var: 0 } }, to: { meta: 2 } }], [], 0)
		expect(result).toEqual([[[{ meta: 5 }, { meta: 2 }]], [], 0])
	})

	it('Can simplify reductions on both sides', () => {
		const result = simplify([{ app: { lam: { var: 0 } }, to: { meta: 2 } }, { app: { lam: { var: 0 } }, to: { meta: 3 } }], [], 0)
		expect(result).toEqual([[[{ meta: 2 }, { meta: 3 }]], [], 0])
	})

	it('Can simplify free var applications', () => {
		const result = simplify([{ app: { free: 5 }, to: { meta: 2 } }, { app: { free: 5 }, to: { meta: 3 } }], [], 0)
		expect(result).toEqual([[[{ meta: 2 }, { meta: 3 }]], [], 0])
	})
})

describe('Try flex/rigid', () => {
	it('Can solve a flex/rigid constraint', () => {
		const result = tryFlexRigid([{ meta: 0 }, { meta: 1 }], [], 0)
		expect(result.head).toEqual([[[], [{ meta: 1 }], 0]])
		
		assert(result.tail)
		const result2 = result.tail()
		expect(result2.head).toEqual([[[], [{ meta: 1 }], 0]])

		assert(result2.tail)
		const result3 = result2.tail()
		expect(result3.head).toEqual([[[], [{ meta: 1 }], 0]])
	})
})
