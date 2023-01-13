// Language
export type SignalName = string
export type SignalWidth = number

export type Signal = SignalWidth | [Signal, ...number[]] | { [key: SignalName]: Signal }

export type VarExpr = SignalName
export type IndexLExpr = ['index', LExpr, RExpr]
export type SliceLExpr = ['slice', LExpr, RExpr, number]
export type ConcatLExpr = ['concat', ...LExpr[]]
export type LExpr = VarExpr | IndexLExpr | SliceLExpr | ConcatLExpr

export type UnaryOp = '!' | '~' | '-' | '+' | '|' | '&' | '^' | '~|' | '~&' | '~^'
export type BinaryOp = '|' | '&' | '^' | '~|' | '~&' | '~^' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '<<' | '>>' | '+' | '-' | '*' | '/' | '%'
export type ConstExpr = number | bigint | [number, number | bigint]
export type UnaryExpr = [UnaryOp, RExpr]
export type BinaryExpr = [BinaryOp, RExpr, RExpr]
export type TernaryExpr = ['?', RExpr, RExpr, RExpr]
export type IndexRExpr = ['index', RExpr, RExpr]
export type SliceRExpr = ['slice', RExpr, RExpr, number]
export type ConcatRExpr = ['concat', ...RExpr[]]
export type RExpr = LExpr | ConstExpr | UnaryExpr | BinaryExpr | TernaryExpr | IndexRExpr | SliceRExpr | ConcatRExpr

export type AssignmentStmt = ['=', LExpr, RExpr]
export type IfStmt = ['if', RExpr, Stmt[], Stmt[]?]
export type RangeMapStmt = ['rangeMap', VarExpr, RExpr, Stmt[]]
export type SignalStmt = ['signal', VarExpr, Signal, { direction?: 'input' | 'output' | 'inout', type?: 'tri' | 'wor' | 'wand' }?]
export type ClockedStmt = ['on', 'posedge' | 'negedge', VarExpr, Stmt[]]
export type Stmt = AssignmentStmt | IfStmt | RangeMapStmt | SignalStmt | ClockedStmt

export type Module = Stmt[]

// Values
export type SignalValue = [number, bigint] | SignalValue[] | { [key: SignalName]: SignalValue }
