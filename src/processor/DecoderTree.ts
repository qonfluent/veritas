import { SignalLike, Constant, Ternary } from "gateware-ts"
import { UnitIndex, DecoderTreeDesc, OperationDesc } from "./Description"
import { BasicModule } from "./Module"

type DecoderTreeInner = {
	unit: UnitIndex
} | {
	zero: DecoderTreeInner
	one: DecoderTreeInner
}

export class DecoderTreeModule extends BasicModule {
	public constructor(
		name: string,
		desc: DecoderTreeDesc,
		units: OperationDesc[],
	) {
		let tree: DecoderTreeInner
		if (desc.ops.length === 1) {
			tree = { unit: 0 }
		} else {
			// Map entries to a tree/weight(bit length) pair
			const mappedEntries: { tree: DecoderTreeInner, weight: number }[]
				= desc.ops.map((unit, i) => ({ tree: { unit: i }, weight: Object.values(units[unit].inputs).reduce((sum, arg) => sum + arg.width, 0)  }))
			
			// Sort entries by weight
			const sortedEntries = mappedEntries.sort(({ weight: lhs }, { weight: rhs }) => lhs - rhs)

			// Form the rest of the tree
			while (sortedEntries.length > 2) {
				const [{ tree: zero, weight: zeroWeight }, { tree: one, weight: oneWeight }] = sortedEntries.splice(0, 2)
				const newNode = { tree: { zero, one }, weight: 1 + Math.max(zeroWeight, oneWeight) }
				// TODO: Use a log search here instead of a linear search!
				const insertIndex = sortedEntries.findIndex(({ weight }) => weight > newNode.weight)
				if (insertIndex !== -1) {
					sortedEntries.splice(insertIndex, 0, newNode)
				} else {
					sortedEntries.push(newNode)
				}
			}

			tree = {
				zero: sortedEntries[0].tree,
				one: sortedEntries[1].tree,
			}
		}

		// Compute the max width of a tree
		const getMaxWidth = (tree: DecoderTreeInner) => 'unit' in tree
			? Object.values(units[tree.unit].inputs).reduce((sum, arg) => sum + arg.width, 0)
			: 1 + Math.max(getMaxWidth(tree.zero), getMaxWidth(tree.one))

		// Compute the width of an opcode
		const opcodeWidth = Math.ceil(Math.log2(desc.ops.length))

		super(name, {
			inputs: {
				instruction: getMaxWidth(tree),
			},
			outputs: {
				opcode: opcodeWidth,
				args: desc.ops.reduce((max, op) => {
					const opWidth = Object.values(units[op].inputs).reduce((sum, arg) => sum + arg.width, 0)
					return max > opWidth ? max : opWidth
				}, 0),
			},
			internals: {},
			arrays: {},
			modules: {},
			logic: (state) => {
				return {
					logic: [
						state.opcode ['='] (this.getOpcode(tree, state.instruction, opcodeWidth)),
						state.args ['='] (this.getArgs(tree, state.instruction, state.args.width)),
					],
				}
			}
		})
	}

	private getOpcode(inner: DecoderTreeInner, instruction: SignalLike, width: number, index = 0): SignalLike {
		if ('unit' in inner) {
			return Constant(width, inner.unit)
		}

		return Ternary(instruction.bit(index), this.getOpcode(inner.one, instruction, width, index + 1), this.getOpcode(inner.zero, instruction, width, index + 1))
	}

	private getArgs(inner: DecoderTreeInner, instruction: SignalLike, argsLen: number, index = 0): SignalLike {
		if ('unit' in inner) {
			return instruction.slice(index, index + argsLen - 1)
		}

		return Ternary(instruction.bit(index), this.getArgs(inner.one, instruction, argsLen, index + 1), this.getArgs(inner.zero, instruction, argsLen, index + 1))
	}
}
