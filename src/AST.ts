export type ConstTerm<A> = { tag: 'const', const: A }
export type VarTerm<A> = { tag: 'var', var: string }
export type SeqTerm<A> = { tag: 'seq', seq: Term<A>[] }
export type SetTerm<A> = { tag: 'set', set: Term<A>[] }
export type Term<A> = ConstTerm<A> | VarTerm<A> | SeqTerm<A> | SetTerm<A>

// Show a term as a string
export function show<A>(term: Term<A>): string {
	switch (term.tag) {
		case 'const': return String(term.const)
		case 'var': return term.var
		case 'seq': return `[${term.seq.map(show).join(', ')}]`
		case 'set': return `{${term.set.map(show).join(', ')}}`
	}
}
