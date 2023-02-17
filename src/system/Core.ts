import { BodyTag, PatternTag, RuleSet } from './Validator'

export const coreRules: RuleSet = {
	Nil: [
		{ tag: PatternTag.Eq, value: [] },
		{ tag: BodyTag.Const, value: [] },
	]
}