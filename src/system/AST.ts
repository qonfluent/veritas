export enum Tag {
	JudgeDimCtx,
	JudgeDimTerm,
	JudgeFormula,
	JudgeCofib,
	JudgeOrder,
	JudgeTypeCtx,
	JudgeType,
	JudgeTerm,

	JudgeDimEq,
	JudgeCofibEq,
	JudgeTypeEq,
	JudgeTermEq,

	DimCtx,
	Formula,
	TypeCtx,

	Interval,
	IntervalZero,
	IntervalOne,
	IntervalVar,

	Cofib,
	CofibEq,
	CofibCoproduct,
	CofibForall,

	AbortType,
	AbortTerm,

	SystemType,
	SystemTerm,
}

export type Dir = { tag: Tag.IntervalZero } | { tag: Tag.IntervalOne } | { tag: Tag.Interval }
export type Interval = Dir | { tag: Tag.IntervalVar, var: string }
export type DimCtx = { tag: Tag.DimCtx, dims: Dir[] }
export type Formula = { tag: Tag.Formula, cofibs: Cofib[] }
export type Cofib =	{ tag: Tag.CofibEq, lhs: Interval, rhs: Interval } | { tag: Tag.CofibCoproduct, lhs: Cofib, rhs: Cofib } | { tag: Tag.CofibForall, cofib: Cofib }
export type TypeCtx = { tag: Tag.TypeCtx, types: Type[] }

export type Type
	= { tag: Tag.AbortType }
	| { tag: Tag.SystemType, system: Map<Cofib, Type> }

export type Term
	= { tag: Tag.AbortTerm }
	| { tag: Tag.SystemTerm, system: Map<Cofib, Term> }

export type CoreJudgement
	= { tag: Tag.JudgeDimCtx, dimCtx: DimCtx }
	| { tag: Tag.JudgeDimTerm, dimCtx: DimCtx, term: Interval }
	| { tag: Tag.JudgeFormula, dimCtx: DimCtx, formula: Formula }
	| { tag: Tag.JudgeCofib, dimCtx: DimCtx, cofib: Cofib }
	| { tag: Tag.JudgeOrder, dimCtx: DimCtx, formula: Formula, cofib: Cofib }
	| { tag: Tag.JudgeTypeCtx, dimCtx: DimCtx, formula: Formula, typeCtx: TypeCtx }
	| { tag: Tag.JudgeType, dimCtx: DimCtx, formula: Formula, typeCtx: TypeCtx, type: Type }
	| { tag: Tag.JudgeTerm, dimCtx: DimCtx, formula: Formula, typeCtx: TypeCtx, term: Term }

	| { tag: Tag.JudgeDimEq, dimCtx: DimCtx, lhs: Interval, rhs: Interval }
	| { tag: Tag.JudgeCofibEq, dimCtx: DimCtx, formula: Formula, lhs: Cofib, rhs: Cofib }
	| { tag: Tag.JudgeTypeEq, dimCtx: DimCtx, formula: Formula, typeCtx: TypeCtx, lhs: Type, rhs: Type }
	| { tag: Tag.JudgeTermEq, dimCtx: DimCtx, formula: Formula, typeCtx: TypeCtx, type: Type, lhs: Term, rhs: Term }
