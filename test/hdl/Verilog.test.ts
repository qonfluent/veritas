import { Module, moduleToVerilog } from "../../src/hdl/Verilog"

describe('Verilog', () => {
	it('Empty module', () => {
		const test = moduleToVerilog({
			name: 'test',
			body: [],
		})

		expect(test).toBe('module test();\n\nendmodule')
	})

	it('Module with ports', () => {
		const test = moduleToVerilog({
			name: 'test',
			body: [
				{
					signal: 'a',
					width: 11,
					direction: 'input',
					type: 'wire',
				},
				{
					signal: 'b',
					width: 11,
					direction: 'output',
					type: 'wire',
				},
			],
		})

		expect(test).toBe('module test(\n\tinput wire [10:0] a,\n\toutput wire [10:0] b\n);\n\nendmodule')
	})

	it('Module with internal signals', () => {
		const test = moduleToVerilog({
			name: 'test',
			body: [
				{
					signal: 'a',
					width: 11,
					type: 'wire',
				},
				{
					signal: 'b',
					width: 11,
					type: 'reg',
				},
			],
		})

		expect(test).toBe('module test();\n\n\twire [10:0] a;\n\treg [10:0] b;\n\nendmodule')
	})

	it('Module with internal signals and ports', () => {
		const test = moduleToVerilog({
			name: 'test',
			body: [
				{
					signal: 'a',
					width: 4,
					type: 'wire',
				},
				{
					signal: 'b',
					width: 11,
					type: 'reg',
				},
				{
					signal: 'c',
					width: 11,
					direction: 'input',
					type: 'wire',
				},
				{
					signal: 'd',
					width: 11,
					direction: 'output',
					type: 'wire',
				},
			],
		})
		expect(test).toBe('module test(\n\tinput wire [10:0] c,\n\toutput wire [10:0] d\n);\n\n\twire [3:0] a;\n\treg [10:0] b;\n\nendmodule')
	})

	it('Module with internal instances', () => {
		const innerModule: Module = {
			name: 'test_inner',
			body: [
				{
					signal: 'a',
					width: 4,
					direction: 'input',
					type: 'wire',
				},
				{
					signal: 'b',
					width: 11,
					direction: 'input',
					type: 'reg',
				},
				{
					signal: 'c',
					width: 11,
					direction: 'input',
					type: 'wire',
				},
				{
					signal: 'd',
					width: 11,
					direction: 'output',
					type: 'wire',
				},
				{
					assign: 'd',
					value: {
						binary: '+',
						left: 'a',
						right: {
							binary: '+',
							left: 'b',
							right: 'c',
						},
					}
				}
			]
		}

		const test = moduleToVerilog({
			name: 'test',
			body: [
				{
					signal: 'a',
					width: 4,
					type: 'wire',
				},
				{
					signal: 'b',
					width: 11,
					type: 'reg',
				},
				{
					signal: 'c',
					width: 11,
					direction: 'input',
					type: 'wire',
				},
				{
					signal: 'd',
					width: 11,
					direction: 'output',
					type: 'wire',
				},
				{
					instance: 'test_inner_inst',
					module: innerModule,
					ports: {
						a: 'a',
						b: 'b',
						c: 'c',
						d: 'd',
					}
				},
			],
		})

		expect(test).toBe('module test(\n\tinput wire [10:0] c,\n\toutput wire [10:0] d\n);\n\n\twire [3:0] a;\n\treg [10:0] b;\n\n\ttest_inner test_inner_inst (\n\t\t.a(a),\n\t\t.b(b),\n\t\t.c(c),\n\t\t.d(d)\n\t);\n\nendmodule')
	})

	it('Module with assignments', () => {
		const test = moduleToVerilog({
			name: 'test',
			body: [
				{
					signal: 'a',
					width: 4,
					type: 'wire',
				},
				{
					signal: 'b',
					width: 11,
					type: 'reg',
				},
				{
					signal: 'c',
					width: 11,
					direction: 'input',
					type: 'wire',
				},
				{
					signal: 'd',
					width: 11,
					direction: 'output',
					type: 'wire',
				},
				{
					assign: 'd',
					value: {
						binary: '+',
						left: 'a',
						right: {
							binary: '+',
							left: 'b',
							right: 'c',
						},
					}
				}
			],
		})

		expect(test).toBe('module test(\n\tinput wire [10:0] c,\n\toutput wire [10:0] d\n);\n\n\twire [3:0] a;\n\treg [10:0] b;\n\n\tassign d = a + (b + c);\n\nendmodule')
	})

	it('Module with always blocks', () => {
		const test = moduleToVerilog({
			name: 'test',
			body: [
				{
					signal: 'clk',
					width: 1,
					type: 'wire',
					direction: 'input',
				},
				{
					signal: 'count',
					width: 32,
					type: 'reg',
					direction: 'output',
				},
				{
					always: 'clk',
					body: [
						{
							assign: 'count',
							value: {
								binary: '+',
								left: 'count',
								right: 1,
							},
						},
					],
				},
			],
		})

		expect(test).toBe('module test(\n\tinput wire clk,\n\toutput reg [31:0] count\n);\n\n\talways @(posedge clk) begin\n\t\tcount <= count + 1;\n\tend\n\nendmodule')
	})

	it('Module with always blocks and if statements', () => {
		const test = moduleToVerilog({
			name: 'test',
			body: [
				{
					signal: 'clk',
					width: 1,
					type: 'wire',
					direction: 'input',
				},
				{
					signal: 'count',
					width: 32,
					type: 'reg',
					direction: 'output',
				},
				{
					always: 'clk',
					body: [
						{
							if: {
								binary: '==',
								left: 'count',
								right: 0,
							},
							then: [
								{
									assign: 'count',
									value: {
										binary: '+',
										left: 'count',
										right: 1,
									},
								},
							],
						},
					],
				},
			],
		})

		expect(test).toBe('module test(\n\tinput wire clk,\n\toutput reg [31:0] count\n);\n\n\talways @(posedge clk) begin\n\t\tif (count == 0) begin\n\t\t\tcount <= count + 1;\n\t\tend\n\tend\n\nendmodule')
	})

	it('Module with always blocks and if statements and else statements', () => {
		const test = moduleToVerilog({
			name: 'test',
			body: [
				{
					signal: 'clk',
					width: 1,
					type: 'wire',
					direction: 'input',
				},
				{
					signal: 'count',
					width: 32,
					type: 'reg',
					direction: 'output',
				},
				{
					always: 'clk',
					body: [
						{
							if: {
								binary: '==',
								left: 'count',
								right: 0,
							},
							then: [
								{
									assign: 'count',
									value: {
										binary: '+',
										left: 'count',
										right: 1,
									},
								},
							],
							else: [
								{
									assign: 'count',
									value: {
										binary: '+',
										left: 'count',
										right: 2,
									},
								},
							],
						},
					],
				},
			],
		})

		expect(test).toBe('module test(\n\tinput wire clk,\n\toutput reg [31:0] count\n);\n\n\talways @(posedge clk) begin\n\t\tif (count == 0) begin\n\t\t\tcount <= count + 1;\n\t\tend else begin\n\t\t\tcount <= count + 2;\n\t\tend\n\tend\n\nendmodule')
	})

	it('Module with for loops', () => {
		const test = moduleToVerilog({
			name: 'test',
			body: [
				{
					signal: 'clk',
					width: 1,
					type: 'wire',
					direction: 'input',
				},
				{
					signal: 'count',
					width: 32,
					type: 'reg',
					direction: 'output',
				},
				{
					always: 'clk',
					body: [
						{
							for: 'i',
							init: 0,
							cond: {
								binary: '<',
								left: 'i',
								right: 10,
							},
							step: {
								binary: '+',
								left: 'i',
								right: 1,
							},
							body: [
								{
									assign: 'count',
									value: {
										binary: '+',
										left: 'count',
										right: 1,
									},
								},
							],
						},
					],
				},
			],
		})

		expect(test).toBe('module test(\n\tinput wire clk,\n\toutput reg [31:0] count\n);\n\n\talways @(posedge clk) begin\n\t\tfor (i = 0; i < 10; i = i + 1) begin\n\t\t\tcount <= count + 1;\n\t\tend\n\tend\n\nendmodule')
	})

	it('Module with unary operators', () => {
		const test = moduleToVerilog({
			name: 'test',
			body: [
				{
					signal: 'clk',
					width: 1,
					type: 'wire',
					direction: 'input',
				},
				{
					signal: 'count',
					width: 32,
					type: 'reg',
					direction: 'output',
				},
				{
					always: 'clk',
					body: [
						{
							assign: 'count',
							value: {
								unary: '!',
								value: 0,
							},
						},
					],
				},
			],
		})

		expect(test).toBe('module test(\n\tinput wire clk,\n\toutput reg [31:0] count\n);\n\n\talways @(posedge clk) begin\n\t\tcount <= !0;\n\tend\n\nendmodule')
	})

	it('Module with ternary operators', () => {
		const test = moduleToVerilog({
			name: 'test',
			body: [
				{
					signal: 'clk',
					width: 1,
					type: 'wire',
					direction: 'input',
				},
				{
					signal: 'count',
					width: 32,
					type: 'reg',
					direction: 'output',
				},
				{
					always: 'clk',
					body: [
						{
							assign: 'count',
							value: {
								ternary: {
									binary: '==',
									left: 'count',
									right: 0,
								},
								one: 1,
								zero: 2,
							},
						},
					],
				},
			],
		})

		expect(test).toBe('module test(\n\tinput wire clk,\n\toutput reg [31:0] count\n);\n\n\talways @(posedge clk) begin\n\t\tcount <= (count == 0) ? 1 : 2;\n\tend\n\nendmodule')
	})
})
