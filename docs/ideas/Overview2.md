# Qonlang

A general system overview of the Qonlang system

## Core Language
- Must be as small as possible
- Must be implemented as a (distributed) state machine
	- Should be implemented as WASM, Verilog, etc
- Must implement the following
	- Structures
		- Value - The set of all values the system can represent
		- Rule - A pair of lists of Values representing before/after conjunction/disjunction
		- RuleSet - A map from some key type to Rules
		- Trace - A list of the RuleSet's key type
		- Thread - A ruleset and a value, along with some other meta-information
		- Machine - The full state of the core on a given node
	- Functions
		- Step machine

## Extended Language
- Add a standard type system and set of common utility types
- Add BNF based Parser language
- Add Document language
- Add Import/Export language
- Add dataflow language with fully differential implementatio

## Operating System
- Resource Management
	- Devices create resources, the OS manages sharing them between programs
- Programs
	- A program is a set of rules describing how data changes over time
	- A program has access to a given set of resources that it can interact with via system variable updates
- Diagnostics
	- Meta-info about the system itself
- Scheduling
	- Provides resource sharing for the CPU
- Memory Management
	- Provides resource sharing for the RAM
- Storage Management
	- Provides resource sharing for storage devices
