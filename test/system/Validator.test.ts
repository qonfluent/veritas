import { RuleSet, PatternTag, BodyTag, Proof, validate } from "../../src/system/Validator"


describe('Core', () => {
	describe('Validator', () => {
		it('should validate the identity rule', () => {
			const rules: RuleSet = {
				identity: [
					{ tag: PatternTag.Bind, var: 'x' },
					{ tag: BodyTag.Var, var: 'x' },
				],
			}
			const proof: Proof = [1, 'identity']
			expect(validate(rules, proof)).toBe(1)
		})

		it('should validate the identity rule with a tuple', () => {
			const rules: RuleSet = {
				identity: [
					{ tag: PatternTag.Bind, var: 'x' },
					{ tag: BodyTag.Var, var: 'x' },
				],
			}
			const proof: Proof = [[1, 2], 'identity']
			expect(validate(rules, proof)).toEqual([1, 2])
		})

		it('should match tuple with const and var', () => {
			const rules: RuleSet = {
				identity: [
					{ tag: PatternTag.Tuple, patterns: [
						{ tag: PatternTag.Eq, value: 1 },
						{ tag: PatternTag.Bind, var: 'x' },
					]},
					{ tag: BodyTag.Var, var: 'x' },
				],
			}
			const proof: Proof = [[1, 2], 'identity']
			expect(validate(rules, proof)).toBe(2)
		})

		it('should match object with const and var', () => {
			const rules: RuleSet = {
				identity: [
					{ tag: PatternTag.Object, patterns: {
						a: { tag: PatternTag.Eq, value: 1 },
						b: { tag: PatternTag.Bind, var: 'x' },
					}},
					{ tag: BodyTag.Var, var: 'x' },
				],
			}
			const proof: Proof = [{ a: 1, b: 2 }, 'identity']
			expect(validate(rules, proof)).toBe(2)
		})
	})
})
