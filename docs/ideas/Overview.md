# Scratchpad

Scratchpad is a full stack system with the full meaning of that phrase. Starting
from a simple virtual machine, Scratchpad defines a high level language,
networking stack, cryptography system, and more(hopefully!)

## Language

The core of the Scratchpad system is a simple logical system which uses first
order unification with a few modifications to enable working with general
semi-invertable reduction systems.

A reduction system is a very general framework for examining computation, for
instance, it is trivial to represent lambda calculus, turing machines, and
cyclic tag systems as reduction systems.

A reduction system is any process which evolves through a tree of states. The
system starts in some initial state S_0, and after some period of time, the
next cycle starts with start S_1, and so on. Each cycle starts at a certain
well defined time T_i, with a state S_i, and the system applies a set of rules
to the state, deriving a set of new states from the set of all rules which can
successfully operate on the input state.

We model the system as a parallel reduction system across a defined set of
values. A program evolves as a changing set of rules attached to the machine,
allowing for metaprogramming and extensability.

## Model Overview

The language model is described by two layers, a virtual and physical
representation. The virtual representation describes an ideal logical system.
The physical representation describe how the logical system is executed by a
set of cooporating but mutally distrustful nodes.

### The Virtual System

The virtual system is defined by a set of values, representing the states the
machine is allowed to be in, and a set of rules, which describe the ways in
which the system is allowed to transation between states.

#### Values

A value is one of the following
- One of a (possibly) infinite set of constant values
	- An error is a special kind of constant
	- As are numbers, chars, strings, etc
	- The set of constants is defined by the set of primitive libraries, described later.
- One of an infinite set of symbols
	- Nominal symbols are identified by name e.g. x, width, image (any string)
	- Unique symbols are identified by a UUID and name, and thus will always be unique
- A sequence of values
- A set of values

The formal syntax definition below has a precise listing of all possible values
and provides a 1:1 text and binary description of them

#### Rules

A rule is defined by a sequent calculus term, corresponding to the following sequent

	Input
	------ [Rule]
	Output

Each rule takes an input value and matches it against the input. If the input
matches the rule's input pattern, then the output value must contain the rule's
output value.

## The Physical System

The physical system is modeled at the most abstract level by a set of communicating
nodes. Each node runs a described algorithm and can communicate with any other node
should the algorithm require it. Some nodes may be malicious, in which case they
may communicate without any restrictions, potentially causing problems with the
protocol. We show a set of mitigations which improve security of the system.

### The Node

Each node has an allocated set of CPU, memory, disk, and network resources,
with possible weights and limits set of these resources. These resource limits
are defined by a node's specification. The nodes are connected to a common P2P
network, which uses an optimized shared data structure for operations within a
single node, and a formally specified binary format for transmission of inter-node
data following a common protocol.

### Programs

A program is defined by a requested initial set of resources, an initial set of
rules, and an initial set of values. The initial set of resources is used by
the program to operate, and may then fluxuate as the program evolves. Resources
may be taken from the program at any time, causing the program to suspend if the
resource is used.
