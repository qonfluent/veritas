// Signal definitions
export type SignalWidth = number
export type SignalName = string
export type SignalType = 'wire' | 'reg' | 'tri' | 'tri0' | 'tri1' | 'triand' | 'trior' | 'trireg' | 'wand' | 'wor'
export type SignalDirection = 'input' | 'output' | 'inout'
export type SignalPort = { width: SignalWidth, direction: SignalDirection, type?: SignalType }
export type SignalInternal = { width: SignalWidth, type?: SignalType }
export type SignalArray = { width: SignalWidth, depth: number | number[], type?: SignalType }
export type Signal = SignalPort | SignalInternal | SignalArray

// Left expression
export type VarExpr = SignalName
export type IndexLExpr = ['index', LExpr, RExpr]
export type SliceLExpr = ['slice', LExpr, RExpr, number]
export type ConcatLExpr = ['concat', LExpr[]]
export type LExpr = VarExpr | IndexLExpr | SliceLExpr | ConcatLExpr

// Right expression
export type UnaryOp = '!' | '~' | '+' | '-' | '&' | '|' | '^' | '~&' | '~|' | '~^'
export type BinaryOp = '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '===' | '!==' | '<' | '<=' | '>' | '>=' | '&&' | '||' | '&' | '|' | '^' | '~&' | '~|' | '~^' | '<<' | '>>'
export type ConstExpr = number | bigint | ['const', SignalWidth, number | bigint]
export type UnaryExpr = [UnaryOp, RExpr]
export type BinaryExpr = [BinaryOp, RExpr, RExpr]
export type TernaryExpr = ['?:', RExpr, RExpr, RExpr]
export type IndexRExpr = ['index', RExpr, RExpr]
export type SliceRExpr = ['slice', RExpr, RExpr, number]
export type ConcatRExpr = ['concat', RExpr[]]
export type RExpr = LExpr | ConstExpr | UnaryExpr | BinaryExpr | TernaryExpr | IndexRExpr | SliceRExpr | ConcatRExpr

// Statements
export type EdgeType = 'posedge' | 'negedge'
export type AssignStmt = ['=', LExpr, RExpr]
export type IfStmt = ['if', RExpr, Stmt[], Stmt[]]
export type CaseStmt = ['case' | 'casez' | 'casex', RExpr, [number | string | (number | string)[] | 'default', Stmt[]][]]
export type ForStmt = ['for', VarExpr, RExpr, RExpr, RExpr, Stmt[]]
export type AlwaysStmt = ['always', VarExpr | [EdgeType, VarExpr] | (VarExpr | [EdgeType, VarExpr])[], Stmt[]]
export type Stmt = AssignStmt | IfStmt | CaseStmt | ForStmt

// Module with all signals expanded
export type VerilogModule = {
	body: Stmt[]
}

export type Module = VerilogModule

export function expandModule(module: Module): VerilogModule {
	return module
}
