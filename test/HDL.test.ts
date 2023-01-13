import { RExpr } from "../src/hdl/HDL"
import { exprToVerilog } from "../src/hdl/Verilog"

describe('HDL', () => {
	it('Should correctly encode binary add expressions to verilog', () => {
		const expr: RExpr = ['+', ['+', 1, 2], ['+', 3, 4]]
		const code = exprToVerilog(expr)
		expect(code).toBe('(1 + 2) + (3 + 4)')
	})

	it('Should correctly encode ternary expressions to verilog', () => {
		const expr: RExpr = ['?', 1, 2, 3]
		const code = exprToVerilog(expr)
		expect(code).toBe('1 ? 2 : 3')
	})

	it('Should correctly encode index expressions to verilog', () => {
		const expr: RExpr = ['index', 'foo', 1]
		const code = exprToVerilog(expr)
		expect(code).toBe('foo[1]')
	})

	it('Should correctly encode slice expressions to verilog', () => {
		const expr: RExpr = ['slice', 'foo', 1, 2]
		const code = exprToVerilog(expr)
		expect(code).toBe('foo[1+:2]')
	})

	it('Should correctly encode concat expressions to verilog', () => {
		const expr: RExpr = ['concat', 1, 2, 3]
		const code = exprToVerilog(expr)
		expect(code).toBe('{ 1, 2, 3 }')
	})

	it('Should correctly encode unary expressions to verilog', () => {
		const expr: RExpr = ['~', 1]
		const code = exprToVerilog(expr)
		expect(code).toBe('~1')
	})
})
