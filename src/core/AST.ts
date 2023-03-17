export enum Tag {
	Lit,
	Var,
	Nil,
	Cons,
}

export type Literal = boolean | number | string | bigint | Uint8Array
export type Var = string

export type LitTerm = [Tag.Lit, Literal]
export type VarTerm = [Tag.Var, Var]
export type NilTerm = [Tag.Nil]
export type ConsTerm = [Tag.Cons, Term, Term]

export type Term = LitTerm | VarTerm | NilTerm | ConsTerm
