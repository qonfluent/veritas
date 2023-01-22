import { Instruction, Program } from '../common/Assembly'
import { CoreDesc } from '../common/Processor'

export function sequenceProgram(program: Program, target: CoreDesc): Instruction[] {
	const result: Instruction[] = []

	program.blocks.forEach((block) => {
		
	})

	return result
}
