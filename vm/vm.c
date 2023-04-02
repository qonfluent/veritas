#include <vm/common.h>

// VM types
typedef U8 * Value;

typedef Array RuleArray;
typedef Array UnifierArray;
typedef Array RuleStateArray;
typedef Array ProgramResultArray;
typedef Array CycleStateArray;

typedef U64 RuleIndex;

typedef struct {
	ValueArray top;
	ValueArray bottom;
} Rule;

typedef struct {
	Value lhs;
	Value rhs;
} UnifyState;

typedef struct {
	ValueArray env;
	UnifierArray unifiers;
	RuleIndex ruleIndex;
} RuleState;

typedef struct {
	U64 length;
	RuleIndex * rules;
} Path;

typedef struct {
	RuleArray rules;
	Value value;
} Program;

typedef struct {
	Program program;
	Path path;
} ProgramResult;

typedef struct {
	ProgramResult state;
	RuleStateArray pending;
	ProgramResultArray complete;
} CycleState;

typedef struct {
	CycleStateArray cycles;
	ProgramResultArray results;
} ProgramState;

void spawn_pending(Program * program, RuleStateArray * result) {
	for (U64 i = 0; i < program->rules.rules->ruleCount; i++) {
		const rule = array_get(program->rules.rules, i);
		for (U64 j = 0; j < rule.top.valueCount; j++) {
			const unifiers = create_array(1, sizeof(UnifyState));
			const env = create_array(0, sizeof(Value));
			const ruleState = (RuleState) { .env = env, .unifiers = unifiers, .ruleIndex = i };
			array_push(result, &ruleState);
		}
	}

	if (isSeq(program->value)) {
		for (U64 i = 0; i < program->value->valueCount; i++) {
			const value = program->value->values[i];
			const program = (Program) { .rules = program->rules, .value = value }
			spawn_pending(program, result);
		}
	}
}

void step(ProgramState * state) {
	if (state->cycles->length == 0) return;
	const cycle = state->cycles[state->cycles->length - 1];

	if (cycle.pending->length == 0) {
		
	}
}
