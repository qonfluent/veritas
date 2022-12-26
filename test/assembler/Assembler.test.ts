import { randomEncoder, randomInstruction } from "../Common"

describe('Assembler', () => {
	it('Can encode and decode instructions', () => {
		const encoder = randomEncoder()

		for (let i = 0; i < 100; i++) {
			const instruction = randomInstruction(encoder)
			const encoded = encoder.encodeInstruction(instruction)
			const decoded = encoder.decodeInstruction(encoded)
			expect(decoded).toEqual(instruction)
		}
	})
})
