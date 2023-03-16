export enum Tag {
	Lit,
	Var,
	Seq,
	Nil,
	Cons,
	Snoc,
	Set,
	Subset,
	_Count
}

export type Literal = boolean | number | string | bigint | Uint8Array
export type Var = string

export type LitTerm = [Tag.Lit, Literal]
export type VarTerm = [Tag.Var, Var]
export type SeqTerm = [Tag.Seq, Term[]]
export type NilTerm = [Tag.Nil]
export type ConsTerm = [Tag.Cons, Term, Term]
export type SnocTerm = [Tag.Snoc, Term, Term]
export type SetTerm = [Tag.Set, Term[]]
export type SubsetTerm = [Tag.Subset, Term[], Term]

export type Term = LitTerm | VarTerm | SeqTerm | NilTerm | ConsTerm | SnocTerm | SetTerm | SubsetTerm

export type Env = Map<Var, Term>

export function showTerm(term: Term): string {
	switch (term[0]) {
		case Tag.Lit: return term instanceof Uint8Array ? `x"${Buffer.from(term).toString('hex')}"` : term[1].toString()
		case Tag.Var: return term[1].toString()
		case Tag.Seq: return `[${term[1].map(showTerm).join(', ')}]`
		case Tag.Nil: return '[]'
		case Tag.Cons: return `[${showTerm(term[1])}, ...${showTerm(term[2])}]`
		case Tag.Snoc: return `[...${showTerm(term[1])}, ${showTerm(term[2])}]`
		case Tag.Set: return `{${term[1].map(showTerm).join(', ')}}`
		case Tag.Subset: return `{${term[1].map(showTerm).join(', ')}, ...${showTerm(term[2])}}`
	}
}

export function showEnv(env: Env): string {
	return `{ ${[...env.entries()].map(([key, value]) => `${key} = ${showTerm(value)}`).join(', ')} }`
}
