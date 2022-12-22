export type SignalDirection = 'input' | 'output' | 'inout'
export type SignalType = 'wire' | 'reg' | 'tri' | 'tri0' | 'tri1' | 'triand' | 'trior' | 'wand' | 'wor' | 'supply0' | 'supply1'
export type UnaryOp = '!' | '~' | '-' | '&' | '|' | '^' | '~&' | '~|' | '~^'
export type BinaryOp = '==' | '!=' | '===' | '!==' | '<' | '<=' | '>' | '>=' | '&&' | '||' | '<<' | '>>' | '<<<' | '>>>' | '+' | '-' | '&' | '|' | '^' | '~&' | '~|' | '~^'

export type VarExpr = string
export type IndexLExpr = { index: LExpr, start: number }
export type SliceLExpr = { slice: LExpr, start: number, end: number }
export type ConcatLExpr = { concat: LExpr[] }
export type LExpr = string | IndexLExpr | SliceLExpr | ConcatLExpr

export type ConstExpr = number | bigint
export type UnaryExpr = { unary: UnaryOp, value: RExpr }
export type BinaryExpr = { binary: BinaryOp, left: RExpr, right: RExpr }
export type TernaryExpr = { ternary: RExpr, one: RExpr, zero: RExpr }
export type RExpr = LExpr | ConstExpr | UnaryExpr | BinaryExpr | TernaryExpr

export type AssignStmt = { assign: LExpr, value: RExpr }
export type IfStmt = { if: RExpr, then: Stmt[], else?: Stmt[] }
export type ForStmt = { for: string, init: RExpr, cond: RExpr, step: RExpr, body: Stmt[] }
export type CaseStmt = { case: RExpr, cases: { value: number, body: Stmt[] }[] }
export type AlwaysStmt = { always: string, edge?: 'posedge' | 'negedge', body: Stmt[] }
export type SignalDefStmt = {
	signal: string
	width: number
	depth?: number[]
	direction?: SignalDirection
	type?: SignalType
}
export type ModuleInstanceStmt = {
	instance: string
	module: Module
	ports: Record<string, RExpr>
}
export type Stmt = AssignStmt | IfStmt | ForStmt | CaseStmt | SignalDefStmt | AlwaysStmt | ModuleInstanceStmt

export type Module = {
	name: string
	body: Stmt[]
}

export function signalDefToVerilog(signal: SignalDefStmt): string {
	const dirStr = signal.direction ? signal.direction + ' ' : ''
	const widthStr = signal.width > 1 ? `[${signal.width - 1}:0] ` : ''
	return `${dirStr}${signal.type ?? 'wire'} ${widthStr}${signal.signal}`
}

export function exprToVerilog(expr: RExpr, parens = false): string {
	if (typeof expr === 'string' || typeof expr === 'number' || typeof expr === 'bigint') {
		return expr.toString()
	} else if ('index' in expr) {
		return `${exprToVerilog(expr.index)}[${expr.start}]`
	} else if ('slice' in expr) {
		return `${exprToVerilog(expr.slice)}[${expr.start}:${expr.end}]`
	} else if ('concat' in expr) {
		return `{ ${expr.concat.map((expr) => exprToVerilog(expr)).join(', ') }}`
	} else if ('unary' in expr) {
		const result = `${expr.unary}${exprToVerilog(expr.value, true)}`
		return parens ? `(${result})` : result
	} else if ('binary' in expr) {
		const result = `${exprToVerilog(expr.left, true)} ${expr.binary} ${exprToVerilog(expr.right, true)}`
		return parens ? `(${result})` : result
	} else if ('ternary' in expr) {
		const result = `${exprToVerilog(expr.ternary, true)} ? ${exprToVerilog(expr.one, true)} : ${exprToVerilog(expr.zero, true)}`
		return parens ? `(${result})` : result
	}

	throw new Error(`Unrecognized expression: ${expr}`)
}

export function statementToVerilog(stmt: Stmt, tabs = 1, blocking = true): string {
	const tabsStr = [...Array(tabs)].map(() => '\t').join('')

	if ('assign' in stmt) {
		if (blocking) {
			// Generate blocking assignments
			return `${tabsStr}assign ${stmt.assign} = ${exprToVerilog(stmt.value)};`
		}

		// Generate non-blocking assignments
		return `${tabsStr}${stmt.assign} <= ${exprToVerilog(stmt.value)};`
	} else if ('if' in stmt) {
		const cond = exprToVerilog(stmt.if)
		const then = stmt.then.map((stmt) => statementToVerilog(stmt, tabs + 1, blocking)).join('\n')
		
		if (stmt.else) {
			const else_ = stmt.else.map((stmt) => statementToVerilog(stmt, tabs + 1, blocking)).join('\n')
			return `${tabsStr}if (${cond}) begin\n${then}\n${tabsStr}end else begin\n${else_}\n${tabsStr}end`
		}

		return `${tabsStr}if (${cond}) begin\n${then}\n${tabsStr}end`
	} else if ('for' in stmt) {
		const body = stmt.body.map((stmt) => statementToVerilog(stmt, tabs + 1, blocking)).join('')
		const header = `for (${stmt.for} = ${exprToVerilog(stmt.init)}; ${exprToVerilog(stmt.cond)}; ${stmt.for} = ${exprToVerilog(stmt.step)}) begin`
		return `${tabsStr}${header}\n${body}\n${tabsStr}end`
	} else if ('case' in stmt) {
		const cases = stmt.cases.map((c) => {
			const body = c.body.map((stmt) => statementToVerilog(stmt, tabs + 1, blocking)).join('\n')
			return `${tabsStr}case ${c.value}: begin\n${body}\n${tabsStr}end`
		}).join('\n')

		return `${tabsStr}case (${exprToVerilog(stmt.case)})\n${cases}\n${tabsStr}endcase`
	} else if ('signal' in stmt) {
		return `${tabsStr}${signalDefToVerilog(stmt)};`
	} else if ('always' in stmt) {
		const body = stmt.body.map((stmt) => statementToVerilog(stmt, tabs + 1, false)).join('\n')
		return `${tabsStr}always @(${stmt.edge ?? 'posedge'} ${stmt.always}) begin\n${body}\n${tabsStr}end`
	} else if ('instance' in stmt) {
		const ports = Object.entries(stmt.ports).map(([port, expr]) => `${tabsStr}\t.${port}(${exprToVerilog(expr)})`).join(',\n')
		return `${tabsStr}${stmt.module.name} ${stmt.instance} (${ports ? '\n' + ports + '\n' : ''}${tabsStr});`
	}

	throw new Error(`Unrecognized statement: ${stmt}`)
}

export function moduleToVerilog(module: Module): string {
	// Extract module parts
	const signals = module.body.filter((stmt) => 'signal' in stmt) as SignalDefStmt[]
	const ports = signals.filter((signal) => signal.direction !== undefined)
	const internals = signals.filter((signal) => signal.direction === undefined)
	const instances = module.body.filter((stmt) => 'instance' in stmt) as ModuleInstanceStmt[]
	const assigns = module.body.filter((stmt) => 'assign' in stmt) as AssignStmt[]
	const main = module.body.filter((stmt) => 'if' in stmt || 'for' in stmt || 'case' in stmt || 'always' in stmt) as AlwaysStmt[]

	// Generate strings from parts
	const portString = ports.map((port) => '\t' + signalDefToVerilog(port)).join(',\n')
	const header = `module ${module.name}(${portString ? '\n' + portString + '\n' : ''});\n\n`
	const internalsString = internals.map((signal) => '\t' + signalDefToVerilog(signal) + ';').join('\n')
	const alwaysString = main.map((main) => statementToVerilog(main)).join('\n\n')
	const footer = 'endmodule'

	// Pad strings with newlines as required
	const paddedInternals = internalsString ? internalsString + '\n\n' : ''
	const paddedInstances = instances.length > 0 ? instances.map((instance) => statementToVerilog(instance)).join('\n') + '\n\n' : ''
	const paddedAssigns = assigns.length > 0 ? assigns.map((assign) => statementToVerilog(assign)).join('\n') + '\n\n' : ''
	const paddedAlways = alwaysString ? alwaysString + '\n\n' : ''

	// Generate result
	return header + paddedInternals + paddedInstances + paddedAssigns + paddedAlways + footer
}
