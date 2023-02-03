import { Instruction } from '../common/Assembly'
import { CoreDesc, DecoderDesc, RegisterFileDesc } from '../common/Processor'
import { clog2 } from '../common/Utils'
import { Signal, SignalValue } from '../hdl/HDL'

export function getInvalidCount(target: DecoderDesc, registerFiles: RegisterFileDesc[]): number {
	if (target.invalidHandler === undefined) {
		return 0
	}

	let result = 0
	target.groups.forEach((group) => {
		group.fields.forEach((field) => {
			switch (field.type) {
				case 'immediate': {
					if (field.maxValue !== undefined) {
						const invalidEntries = (1 << field.width) - field.maxValue
						result = result === 0 ? invalidEntries : result * invalidEntries
					}

					break
				}
				case 'register': {
					if (field.staticIndex === undefined) {
						const rf = registerFiles.find((x) => x.name === field.registerFile)
						if (rf === undefined) {
							throw new Error(`Unknown register file ${field.registerFile}`)
						}

						if (rf.uniform) {
							const invalidEntries = (1 << clog2(rf.count)) - rf.count
							result = result === 0 ? invalidEntries : result * invalidEntries
						} else {
							const invalidEntries = (1 << clog2(rf.widthsBytes.length)) - rf.widthsBytes.length
							result = result === 0 ? invalidEntries : result * invalidEntries
						}
					}

					break
				}
				case 'join': {
					break
				}
				case 'decode': {
					const invalidEntries = (1 << clog2(field.ops.length)) - field.ops.length
					result = result === 0 ? invalidEntries : result * invalidEntries

					field.ops.forEach((op) => {
						op.args.forEach((arg) => {
							switch (arg.type) {
								case 'immediate': {
									if (arg.maxValue !== undefined) {
										const invalidEntries = (1 << arg.width) - arg.maxValue
										result = result === 0 ? invalidEntries : result * invalidEntries
									}

									break
								}
								case 'register': {
									if (arg.staticIndex === undefined) {
										const rf = registerFiles.find((x) => x.name === arg.registerFile)
										if (rf === undefined) {
											throw new Error(`Unknown register file ${arg.registerFile}`)
										}

										if (rf.uniform) {
											const invalidEntries = (1 << clog2(rf.count)) - rf.count
											result = result === 0 ? invalidEntries : result * invalidEntries
										} else {
											const invalidEntries = (1 << clog2(rf.widthsBytes.length)) - rf.widthsBytes.length
											result = result === 0 ? invalidEntries : result * invalidEntries
										}
									}

									break
								}
							}
						})
					})

					break
				}
			}
		})
	})

	return result
}

export function validateExtraSignals(value: SignalValue, expected: Signal): void {
	if (typeof expected === 'number') {
		if (!(value instanceof Array) || value.length !== 2 || typeof value[0] !== 'number' || typeof value[1] !== 'bigint') {
			throw new Error(`Expected [bits, value] for extra signal, got ${value}`)
		}
		
		if (value[0] !== expected) {
			throw new Error(`Expected ${expected} bits for extra signal, got ${value[0]}`)
		}

		if (value[1] >= (1n << BigInt(expected))) {
			throw new Error(`Expected value of ${expected} bits for extra signal, got ${value[1]}`)
		}
	} else if (expected instanceof Array) {
		if (!(value instanceof Array)) {
			throw new Error(`Expected array for extra signal, got ${value}`)
		}

		const [type, ...dims] = expected

		if (dims.length === 0) {
			throw new Error(`Expected array with dimensions for extra signal, got ${expected}`)
		}
		
		if (dims.length === 1) {
			if (value.length !== dims[0]) {
				throw new Error(`Expected array of length ${dims[0]} for extra signal, got ${value}`)
			}

			value.forEach((v) => validateExtraSignals(v, type))
		}

		value.forEach((v) => validateExtraSignals(v, [type, ...dims.slice(1)]))
	} else {
		if (typeof value !== 'object' || value === null) {
			throw new Error(`Expected object for extra signal, got ${value}`)
		}

		const entires = Object.entries(expected)
		entires.forEach(([name, type]) => {
			if (!(name in value)) {
				throw new Error(`Expected extra signal ${name} to be present`)
			}

			validateExtraSignals(value[name], type)
		})
	}
}

export function validate(program: Instruction[], target: DecoderDesc, registerFiles: RegisterFileDesc[]): void {
	const invalidCount = getInvalidCount(target, registerFiles)
	program.forEach((instruction, line_number) => {
		if ('invalid' in instruction) {
			if (instruction.invalid >= invalidCount) {
				throw new Error(`Invalid instruction ${instruction.invalid} >= ${invalidCount} (invalid instruction encoding)`)
			}
		} else {
			if (target.extraSignals !== undefined) {
				if (instruction.extra === undefined) {
					throw new Error(`Target has extra signals but none were provided in instruction: ${target.extraSignals}\nLine: ${line_number}`)
				}

				validateExtraSignals(instruction.extra, target.extraSignals)
			}
		}
	})
}
