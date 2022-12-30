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
export type AlwaysStmt = ['always', '*' | [EdgeType, VarExpr], Stmt[]]
export type SignalStmt = ['signal', SignalName, Signal]
export type ModuleInstanceStmt = ['module', string, string, Record<string, RExpr>]
export type Stmt = AssignStmt | IfStmt | CaseStmt | ForStmt | AlwaysStmt | SignalStmt | ModuleInstanceStmt

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

export function exprToVerilog(expr: RExpr): string {
	if (typeof expr === 'string') {
		return expr
	} else if (typeof expr === 'number' || typeof expr === 'bigint') {
		return expr.toString()
	}

	if (expr.length === 2) {
		// Concat
		if (expr[0] === 'concat') {
			return `{${expr[1].map(exprToVerilog).join(', ')}}`
		}

		// Unary
		return `${expr[0]} ${exprToVerilog(expr[1])}`
	} else if (expr.length === 3) {
		// Const
		if (expr[0] === 'const') {
			return `${expr[1]}'d${expr[2].toString()}`
		} else if (expr[0] === 'index') {
			return `${exprToVerilog(expr[1])}[${exprToVerilog(expr[2])}]`
		}

		// Binary
		return `${exprToVerilog(expr[1])} ${expr[0]} ${exprToVerilog(expr[2])}`
	} else if (expr.length === 4) {
		// Slice
		if (expr[0] === 'slice') {
			// TODO: Handle the other two forms of slice here
			return `${exprToVerilog(expr[1])}[${exprToVerilog(expr[2])}+:${expr[3]}]`
		}

		// Ternary
		return `${exprToVerilog(expr[1])} ? ${exprToVerilog(expr[2])} : ${exprToVerilog(expr[3])}`
	}

	throw new Error(`Invalid expression: ${expr}`)
}

export function stmtToVerilog(stmt: Stmt, blocking = true, tabCount = 1, inAlways = false): string {
	const tabs = '\t'.repeat(tabCount)
	
	switch (stmt[0]) {
		case '=': {
			return `${tabs}${blocking ? 'assign ' : ''}${exprToVerilog(stmt[1])} ${blocking ? '=' : '<='} ${exprToVerilog(stmt[2])};`
		}
		case 'if': {
			const ifStr = `${tabs}if (${exprToVerilog(stmt[1])}) begin\n${stmt[2].map(stmt => stmtToVerilog(stmt, blocking, tabCount + 1, inAlways)).join('\n')}\n${tabs}end`
			const elseStr = stmt[3] ? `\n${tabs}else begin\n${stmt[3].map(stmt => stmtToVerilog(stmt, blocking, tabCount + 1, inAlways)).join('\n')}\n${tabs}end` : ''
			return ifStr + elseStr
		}
		case 'for': {
			const forVar = stmt[1]
			const forHeader = `${tabs}for (${forVar} = ${exprToVerilog(stmt[2])}; ${exprToVerilog(stmt[3])}; ${exprToVerilog(stmt[4])}) begin`
			const forBody = stmt[5].map(stmt => stmtToVerilog(stmt, blocking, tabCount + 1, inAlways)).join('\n')
			const forFooter = `\n${tabs}end`
			return forHeader + '\n' + forBody + forFooter
		}
		case 'always': {
			assert(!inAlways, 'Cannot nest always blocks')

			const rest = `${stmt[2].map(stmt => stmtToVerilog(stmt, false, tabCount + 1, true)).join('\n')}\n${tabs}end`

			if (stmt[1] instanceof Array) {
				return `${tabs}always @(${stmt[1][0]} ${stmt[1][1]}) begin\n` + rest
			}

			return `${tabs}always @* begin\n` + rest
		}
		case 'case': {
			const caseStr = `${tabs}case (${exprToVerilog(stmt[1])})`
			const caseBody = stmt[2].map((caseItem) => {
				const caseItemStr = caseItem[0] instanceof Array ? caseItem[0].map((x) => `${tabs}\t${x}`).join(':\n') : `${tabs}\t${caseItem[0]}`
				const caseItemBody = caseItem[1].map(stmt => stmtToVerilog(stmt, blocking, tabCount + 2, inAlways)).join('\n')
				return `\n${caseItemStr}: begin\n${caseItemBody}\n${tabs}\tend`
			}).join('')
			const caseFooter = `\n${tabs}endcase`

			return caseStr + caseBody + caseFooter
		}
		case 'signal': {
			return signalToVerilog(stmt)
		}
		case 'module': {
			const portsStr = Object.entries(stmt[3]).map(([name, value]) => `.${name}(${exprToVerilog(value)})}`).join(',\n')
			return `${tabs}${stmt[1]} ${stmt[2]} (${portsStr ? '\n' + portsStr + '\n' : ''});`
		}
	}

	throw new Error(`Invalid statement: ${stmt}`)
}

export function moduleToVerilog(name: string, module: VerilogModule): string {
	// Get the ports and internals stringified
	const signals = module.body.filter((stmt): stmt is SignalStmt => stmt[0] === 'signal')
	const [ports, internals] = partition(signals, (stmt) => 'direction' in stmt[2])
	const portsStr = ports.map((stmt) => '\t' + signalToVerilog(stmt)).join(',\n')
	const internalsStr = internals.map((stmt) => '\t' + signalToVerilog(stmt) + ';').join('\n')

	// Fill out the rest of the content
	const headerStr = `module ${name}(${portsStr ? '\n' + portsStr + '\n' : ''});`
	const instancesStr = module.body.filter((stmt) => stmt[0] === 'module').map((stmt) => stmtToVerilog(stmt)).join('\n')
	const bodyStr = module.body.filter((stmt) => stmt[0] !== 'signal' && stmt[0] !== 'module').map((stmt) => stmtToVerilog(stmt)).join('\n')
	const footerStr = 'endmodule'

	// Generate final result
	return `${headerStr}\n\n${internalsStr ? internalsStr + '\n\n' : ''}${instancesStr ? instancesStr + '\n\n' : ''}${bodyStr ? bodyStr + '\n\n' : ''}${footerStr}`
}
