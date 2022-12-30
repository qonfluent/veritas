import assert from "assert"
import { partition } from "../common/Util"

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
export type IfStmt = ['if', RExpr, Stmt[]] | ['if', RExpr, Stmt[], Stmt[]]
export type CaseStmt = ['case' | 'casez' | 'casex', RExpr, [number | string | (number | string)[] | 'default', Stmt[]][]]
export type ForStmt = ['for', VarExpr, RExpr, RExpr, RExpr, Stmt[]]
export type AlwaysStmt = ['always', VarExpr | (VarExpr | [EdgeType, VarExpr])[], Stmt[]]
export type SignalStmt = ['signal', SignalName, Signal]
export type Stmt = AssignStmt | IfStmt | CaseStmt | ForStmt | AlwaysStmt | SignalStmt

// Module with all signals expanded
export type VerilogModule = {
	body: Stmt[]
}

export function getExprVars(expr: RExpr): VarExpr[] {
	if (typeof expr === 'string') {
		return [expr]
	} else if (!(expr instanceof Array)) {
		return []
	}
	
	if (expr.length === 2) {
		if (expr[0] === 'concat') {
			return expr[1].flatMap(getExprVars)
		}

		return getExprVars(expr[1])
	} else if (expr.length === 3) {
		if (expr[0] === 'const') {
			return []
		}

		return getExprVars(expr[1]).concat(getExprVars(expr[2]))
	} else if (expr.length === 4) {
		if (expr[0] === 'slice') {
			return getExprVars(expr[1]).concat(getExprVars(expr[2]))
		}

		return getExprVars(expr[1]).concat(getExprVars(expr[2])).concat(getExprVars(expr[3]))
	}

	throw new Error(`Invalid expression: ${expr}`)
}

export enum VarType {
	LVar,
	RVar,
}

export function getStmtVars(type: VarType, stmt: Stmt): VarExpr[] {
	switch (stmt[0]) {
		case '=': {
			switch (type) {
				case VarType.LVar: {
					return getExprVars(stmt[1])
				}
				case VarType.RVar: {
					return getExprVars(stmt[2])
				}
			}
		}
		case 'if': {
			const bodyVars = stmt[2].flatMap(stmt => getStmtVars(type, stmt)).concat(stmt[3]?.flatMap(stmt => getStmtVars(type, stmt)) ?? [])

			switch (type) {
				case VarType.LVar: {
					return bodyVars
				}
				case VarType.RVar: {
					return getExprVars(stmt[1]).concat(bodyVars)
				}
			}
		}
		case 'case': {
			const bodyVars = stmt[2].flatMap(([_, stmts]) => stmts.flatMap(stmt => getStmtVars(type, stmt)))

			switch (type) {
				case VarType.LVar: {
					return bodyVars
				}
				case VarType.RVar: {
					return getExprVars(stmt[1]).concat(bodyVars)
				}
			}
		}
		case 'for': {
			const bodyVars = getExprVars(stmt[1]).concat(getExprVars(stmt[2]), getExprVars(stmt[3]), stmt[5].flatMap(stmt => getStmtVars(type, stmt)))

			switch (type) {
				case VarType.LVar: {
					return [stmt[1]].concat(bodyVars)
				}
				case VarType.RVar: {
					return bodyVars
				}
			}
		}
		case 'always': {
			const clockVars = stmt[1] instanceof Array ? stmt[1].flatMap((expr) => typeof expr === 'string' ? [expr] : getExprVars(expr[1])) : [stmt[1]]
			const bodyVars = stmt[2].flatMap(stmt => getStmtVars(type, stmt))

			switch (type) {
				case VarType.LVar: {
					return bodyVars
				}
				case VarType.RVar: {
					return bodyVars.concat(clockVars)
				}
			}
		}
		case 'signal': {
			return []
		}
	}

	throw new Error(`Invalid statement: ${stmt}`)
}

export function signalToVerilog(signal: SignalStmt): string {
	assert(signal[2].width >= 1, `Signal ${signal[1]} has width ${signal[2].width}, must be at least 1 bit`)
	const widthStr = signal[2].width === 1 ? '' : `[0:${signal[2].width - 1}] `
	return `${'direction' in signal[2] ? signal[2].direction + ' ' : ''}${signal[2].type ?? 'wire'} ${widthStr}${signal[1]}`
}

export function moduleToVerilog(name: string, module: VerilogModule): string {
	const signals = module.body.filter((stmt): stmt is SignalStmt => stmt[0] === 'signal')
	const [ports, internals] = partition(signals, (stmt) => 'direction' in stmt[2])

	const portsStr = ports.map((stmt) => '\t' + signalToVerilog(stmt)).join(',\n')
	const internalsStr = internals.map((stmt) => '\t' + signalToVerilog(stmt) + ';').join('\n')

	const headerStr = `module ${name}(${portsStr ? '\n' + portsStr + '\n' : ''});`
	const footerStr = 'endmodule'

	return `${headerStr}\n\n${internalsStr}\n\n${footerStr}`
}
