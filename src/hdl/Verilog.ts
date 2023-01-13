import { RExpr } from './HDL'

export function exprToVerilog(expr: RExpr, parens = false): string {
	switch (typeof expr) {
		case 'number':
		case 'bigint': {
			return expr.toString()
		}
		case 'string': {
			return expr
		}
	}

	if (typeof expr[0] === 'number') {
		return expr[0] + `'d${expr[1]}`
	}

	switch (expr[0]) {
		case 'concat': {
			return `{ ${expr.slice(1).map((expr) => exprToVerilog(expr)).join(', ')} }`
		}
		case 'index': {
			return `${exprToVerilog(expr[1])}[${exprToVerilog(expr[2])}]`
		}
		case 'slice': {
			return `${exprToVerilog(expr[1])}[${exprToVerilog(expr[2])}+:${expr[3]}]`
		}
		case '?': {
			const result = `${exprToVerilog(expr[1], true)} ? ${exprToVerilog(expr[2], true)} : ${exprToVerilog(expr[3], true)}`
			return parens ? `(${result})` : result
		}
	}

	switch (expr.length) {
		case 2: {
			const result = `${expr[0]}${exprToVerilog(expr[1], true)}`
			return parens ? `(${result})` : result
		}
		case 3: {
			const result = `${exprToVerilog(expr[1], true)} ${expr[0]} ${exprToVerilog(expr[2], true)}`
			return parens ? `(${result})` : result
		}
	}
}
