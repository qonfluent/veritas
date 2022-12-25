import assert from "assert"

export type SignalDirection = 'input' | 'output' | 'inout'
export type SignalType = 'wire' | 'reg' | 'tri' | 'tri0' | 'tri1' | 'triand' | 'trior' | 'wand' | 'wor' | 'supply0' | 'supply1' | 'integer' | 'genvar'
export type UnaryOp = '!' | '~' | '-' | '&' | '|' | '^' | '~&' | '~|' | '~^'
export type BinaryOp = '==' | '!=' | '===' | '!==' | '<' | '<=' | '>' | '>=' | '&&' | '||' | '<<' | '>>' | '<<<' | '>>>' | '+' | '-' | '&' | '|' | '^' | '~&' | '~|' | '~^'

export type VarExpr = string
export type IndexLExpr = { index: LExpr, start: RExpr }
export type SliceLExpr = { slice: LExpr, start: RExpr, end: RExpr }
export type ConcatLExpr = { concat: LExpr[] }
export type LExpr = string | IndexLExpr | SliceLExpr | ConcatLExpr

export type ConstExpr = number | bigint | { value: number | bigint, width: number }
export type UnaryExpr = { unary: UnaryOp, value: RExpr }
export type BinaryExpr = { binary: BinaryOp, left: RExpr, right: RExpr }
export type TernaryExpr = { ternary: RExpr, one: RExpr, zero: RExpr }
export type IndexRExpr = { index: RExpr, start: RExpr }
export type SliceRExpr = { slice: RExpr, start: RExpr, end: RExpr }
export type ConcaRLExpr = { concat: RExpr[] }
export type RExpr = LExpr | ConstExpr | UnaryExpr | BinaryExpr | TernaryExpr | IndexRExpr | SliceRExpr | ConcaRLExpr

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
	if (signal.type === 'integer') {
		assert(signal.direction === undefined)
		assert(signal.width === 32)
		assert(signal.depth === undefined)

		return `integer ${signal.signal}`
	} else if (signal.type === 'genvar') {
		assert(signal.direction === undefined)
		assert(signal.width === 32)
		assert(signal.depth === undefined)

		return `genvar ${signal.signal}`
	}

	const dirStr = signal.direction ? signal.direction + ' ' : ''
	const widthStr = signal.width > 1 ? `[${signal.width - 1}:0] ` : ''
	const depthStr = signal.depth ? signal.depth.map((count) => ` [${count - 1}:0]`).join('') : ''
	return `${dirStr}${signal.type ?? 'wire'} ${widthStr}${signal.signal}${depthStr}`
}

export function exprToVerilog(expr: RExpr, parens = false): string {
	if (typeof expr === 'string' || typeof expr === 'number' || typeof expr === 'bigint') {
		return expr.toString()
	} else if ('value' in expr && 'width' in expr) {
		return `${expr.width}'d${expr.value.toString()}`
	} else if ('index' in expr) {
		return `${exprToVerilog(expr.index)}[${exprToVerilog(expr.start)}]`
	} else if ('slice' in expr) {
		return `${exprToVerilog(expr.slice)}[${exprToVerilog(expr.end)}:${exprToVerilog(expr.start)}]`
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

	throw new Error(`Unrecognized expression: ${JSON.stringify(expr)}`)
}

export function statementToVerilog(stmt: Stmt, tabs = 1, blocking = true): string {
	const tabsStr = [...Array(tabs)].map(() => '\t').join('')

	if ('assign' in stmt) {
		const lhs = exprToVerilog(stmt.assign)
		const rhs = exprToVerilog(stmt.value)

		if (blocking) {
			// Generate blocking assignments
			return `${tabsStr}assign ${lhs} = ${rhs};`
		}

		// Generate non-blocking assignments
		return `${tabsStr}${lhs} <= ${rhs};`
	} else if ('if' in stmt) {
		const cond = exprToVerilog(stmt.if)
		const then = stmt.then.map((stmt) => statementToVerilog(stmt, tabs + 1, blocking)).join('\n')
		
		if (stmt.else) {
			const else_ = stmt.else.map((stmt) => statementToVerilog(stmt, tabs + 1, blocking)).join('\n')
			return `${tabsStr}if (${cond}) begin\n${then}\n${tabsStr}end else begin\n${else_}\n${tabsStr}end`
		}

		return `${tabsStr}if (${cond}) begin\n${then}\n${tabsStr}end`
	} else if ('for' in stmt) {
		const init = exprToVerilog(stmt.init)
		const cond = exprToVerilog(stmt.cond)
		const step = exprToVerilog(stmt.step)
		const body = stmt.body.map((stmt) => statementToVerilog(stmt, tabs + 1, blocking)).join('\n')
		return `${tabsStr}for (${stmt.for} = ${init}; ${cond}; ${stmt.for} = ${step}) begin\n${body}\n${tabsStr}end`
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

	throw new Error(`Unrecognized statement: ${JSON.stringify(stmt)}`)
}

export enum VarType {
	LVar,
	RVar,
	ForVar,
}

export function getExprVars(type: VarType, expr: RExpr): string[] {
	if (typeof expr === 'number' || typeof expr === 'bigint') {
		return []
	} else if (typeof expr === 'string') {
		if (type === VarType.LVar || type === VarType.RVar) {
			return [expr]
		}

		return []
	} else if ('value' in expr && 'width' in expr) {
		return []
	} else if ('index' in expr) {
		return getExprVars(type, expr.index).concat(getExprVars(type, expr.start))
	} else if ('slice' in expr) {
		return getExprVars(type, expr.slice).concat(getExprVars(type, expr.start), getExprVars(type, expr.end))
	} else if ('concat' in expr) {
		return expr.concat.flatMap((expr) => getExprVars(type, expr))
	} else if ('unary' in expr) {
		return getExprVars(type, expr.value)
	} else if ('binary' in expr) {
		return getExprVars(type, expr.left).concat(getExprVars(type, expr.right))
	} else if ('ternary' in expr) {
		return getExprVars(type, expr.ternary).concat(getExprVars(type, expr.zero)).concat(getExprVars(type, expr.one))
	}

	throw new Error(`Unrecognized expression: ${JSON.stringify(expr)}`)
}

export function getStmtVars(type: VarType, stmt: Stmt): string[] {
	if ('assign' in stmt) {
		switch (type) {
			case VarType.LVar: {
				return getExprVars(type, stmt.assign)
			}
			case VarType.RVar: {
				return getExprVars(type, stmt.value)
			}
			case VarType.ForVar: {
				return []
			}
		}
	} else if ('if' in stmt) {
		return getExprVars(type, stmt.if).concat(stmt.then.flatMap((stmt) => getStmtVars(type, stmt))).concat(stmt.else?.flatMap((stmt) => getStmtVars(type, stmt)) ?? [])
	} else if ('for' in stmt) {
		switch (type) {
			case VarType.LVar:
			case VarType.RVar:{
				return getExprVars(type, stmt.init).concat(getExprVars(type, stmt.cond), getExprVars(type, stmt.step), ...stmt.body.map((stmt) => getStmtVars(type, stmt)))
			}
			case VarType.ForVar: {
				return [stmt.for].concat(...stmt.body.map((stmt) => getStmtVars(type, stmt)))
			}
		}
	} else if ('case' in stmt) {
		return getExprVars(type, stmt.case).concat(stmt.cases.flatMap((c) => c.body.flatMap((stmt) => getStmtVars(type, stmt))))
	} else if ('always' in stmt) {
		return stmt.body.flatMap((stmt) => getStmtVars(type, stmt))
	} else if ('instance' in stmt) {
		return Object.values(stmt.ports).flatMap((expr) => getExprVars(type, expr))
	}

	return []
}

export function getUniqueModules(module: Module): Module[] {
	// Get all module instance statements
	const innerModules = module.body.filter((stmt): stmt is ModuleInstanceStmt => 'instance' in stmt)

	// Recursively get all modules
	const recurModules = innerModules.flatMap((stmt) => getUniqueModules(stmt.module).concat(stmt.module))

	// Filter out duplicates by name
	const usedNames = new Set<string>()
	const uniqueModules = recurModules.filter((module) => {
		if (usedNames.has(module.name)) {
			return false
		}

		usedNames.add(module.name)
		return true
	})

	return uniqueModules
}

export function normalizeModule(module: Module): Module {
	// Collect all always blocks from the module
	const alwaysBlocks = module.body.filter((stmt): stmt is AlwaysStmt => 'always' in stmt)

	// Collect all LVars from the always blocks
	const regNames = alwaysBlocks.flatMap((block) => getStmtVars(VarType.LVar, block))

	// Fix up definitions of registers
	const fixedBody = module.body.flatMap((stmt): Stmt[] => {
		if ('signal' in stmt && regNames.includes(stmt.signal) && (stmt.type === undefined || stmt.type === 'wire')) {
			return [{
				...stmt,
				type: 'reg',
			}]
		}

		return [stmt]
	})

	// Fix up for loop variables
	const alwaysForVars = new Set(alwaysBlocks.flatMap((block) => getStmtVars(VarType.ForVar, block)))
	const allForVars = new Set(module.body.flatMap((stmt) => getStmtVars(VarType.ForVar, stmt)))
	const forVarDefs: Stmt[] = [...allForVars].map((varName) => {
		if (alwaysForVars.has(varName)) {
			return { signal: varName, width: 32, type: 'integer' }
		} else {
			return { signal: varName, width: 32, type: 'genvar' }
		}
	})

	return {
		name: module.name,
		body: forVarDefs.concat(fixedBody),
	}
}

export function validateModule(module: Module): void {
	// Get used vars
	const usedLVars = new Set(module.body.flatMap((stmt) => getStmtVars(VarType.LVar, stmt)))
	const usedRVars = new Set(module.body.flatMap((stmt) => getStmtVars(VarType.RVar, stmt)))
	
	// Get defined vars
	const definedVarsList = module.body.filter((stmt): stmt is SignalDefStmt => 'signal' in stmt).map((stmt) => stmt.signal)
	const definedVars = new Set(definedVarsList)

	// Get clocks
	const clocks = new Set(module.body.filter((stmt): stmt is AlwaysStmt => 'always' in stmt).map((stmt) => stmt.always))

	// Check for undefined vars
	const undefinedVars = [...usedLVars, ...usedRVars].filter((varName) => !definedVars.has(varName))
	if (undefinedVars.length > 0) {
		throw new Error(`Undefined variables: ${undefinedVars.join(', ')}`)
	}

	// Check for unused vars
	const unusedVars = definedVarsList.filter((varName) => !usedLVars.has(varName) && !usedRVars.has(varName) && !clocks.has(varName))
	if (unusedVars.length > 0) {
		throw new Error(`Unused variables: ${unusedVars.join(', ')}`)
	}

	// Check for duplicate vars
	const duplicateVars = definedVarsList.filter((varName, index) => definedVarsList.indexOf(varName) !== index)
	if (duplicateVars.length > 0) {
		throw new Error(`Duplicate variables: ${duplicateVars.join(', ')}`)
	}
}

export function moduleToVerilog(module: Module, ignoreErrors = false, innerModules = true): string {
	// Normalize module
	module = normalizeModule(module)

	// Validate module
	if (!ignoreErrors) {
		validateModule(module)
	}

	// Extract module ports and internals
	const signals = module.body.filter((stmt): stmt is SignalDefStmt => 'signal' in stmt)
	const ports = signals.filter((signal) => signal.direction !== undefined)
	const internals = signals.filter((signal) => signal.direction === undefined)

	// Extract remaining statements
	const instances = module.body.filter((stmt): stmt is ModuleInstanceStmt => 'instance' in stmt)
	const assigns = module.body.filter((stmt) => 'assign' in stmt)
	const main = module.body.filter((stmt) => 'if' in stmt || 'for' in stmt || 'case' in stmt || 'always' in stmt)

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

	// Generate child modules
	let paddedModules = ''
	if (innerModules) {
		const uniqueModules = getUniqueModules(module)
		paddedModules = (uniqueModules.length > 0 ? '\n\n' : '') + uniqueModules.map((module) => moduleToVerilog(module, ignoreErrors, false)).join('\n\n')
	}

	// Generate result
	return header + paddedInternals + paddedInstances + paddedAssigns + paddedAlways + footer + paddedModules
}
