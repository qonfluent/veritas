import { moduleToVerilog, VerilogModule } from "../../src/hdl/Verilog"

describe('Verilog', () => {
	it('should generate Verilog', () => {
		const module: VerilogModule = {
			body: [
				['signal', 'a', { type: 'wire', width: 1 }],
				['signal', 'b', { type: 'wire', width: 16 }],
				['signal', 'c', { type: 'wire', width: 1, direction: 'input' }],
				['signal', 'd', { type: 'wire', width: 16, direction: 'input' }],
				['signal', 'e', { type: 'wire', width: 1, direction: 'output' }],
				['signal', 'f', { type: 'wire', width: 16, direction: 'output' }],
				['signal', 'g', { type: 'tri', width: 16 }],
			]
		}

		const code = moduleToVerilog('test', module)
		expect(code).toBe('module test(\n\tinput wire c,\n\tinput wire [0:15] d,\n\toutput wire e,\n\toutput wire [0:15] f\n);\n\n\twire a;\n\twire [0:15] b;\n\ttri [0:15] g;\n\nendmodule')
	})

	it('should generate Verilog with assigns', () => {
		const module: VerilogModule = {
			body: [
				['signal', 'a', { type: 'wire', width: 1 }],
				['signal', 'b', { type: 'wire', width: 16 }],
				['signal', 'c', { type: 'wire', width: 1, direction: 'input' }],
				['signal', 'd', { type: 'wire', width: 16, direction: 'input' }],
				['signal', 'e', { type: 'wire', width: 1, direction: 'output' }],
				['signal', 'f', { type: 'wire', width: 16, direction: 'output' }],
				['signal', 'g', { type: 'tri', width: 16 }],
				['=', 'a', 'c'],
				['=', 'b', 'd'],
				['=', 'e', 'a'],
				['=', 'f', 'b'],
			]
		}

		const code = moduleToVerilog('test', module)
		expect(code).toBe('module test(\n\tinput wire c,\n\tinput wire [0:15] d,\n\toutput wire e,\n\toutput wire [0:15] f\n);\n\n\twire a;\n\twire [0:15] b;\n\ttri [0:15] g;\n\n\tassign a = c;\n\tassign b = d;\n\tassign e = a;\n\tassign f = b;\n\nendmodule')
	})
})
