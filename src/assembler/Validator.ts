import { Instruction } from '../common/Assembly'
import { CoreDesc, DecoderDesc, RegisterFileDesc } from '../common/Processor'
import { clog2 } from '../common/Utils'

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

export function validate(program: Instruction[], target: DecoderDesc, registerFiles: RegisterFileDesc[]): void {
	const invalidCount = getInvalidCount(target, registerFiles)
	program.forEach((instruction) => {
		if ('invalid' in instruction) {

		}
	})
}
