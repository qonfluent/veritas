import assert from "assert"
import { CoreDesc } from "./Core"
import { Instruction, Operation } from "./Decoder"
import { OperationDesc, OperationalUnit, ArgMode } from "./Operation"
import { DataValue, DataTag, RegisterIndex } from "./Types"

export type UnitIndex = number

export enum MergeTag {
	Error,
	Queue,
}

export type MergeDesc = {
	tag: MergeTag.Error
} | {
	tag: MergeTag.Queue
	length: number
}

// RegisterMap[decoder][register] = core register index
export type RegisterMap = number[][]

export type DistributorDesc = {
	units: {
		op: OperationDesc
		merge: MergeDesc
	}[]
	// TODO: Instead have a stall matrix to select what decoders to stall when
	stallAll: boolean
	unitMap: { groups: { lanes: { ops: UnitIndex[] }[] }[] }[]
	regMap: RegisterMap
}

export class DistributorUnit {
	private readonly _units: {
		unit: OperationalUnit
		queue: DataValue[][]
	}[]
	
	private readonly _regs: DataValue[]

	public constructor(
		private readonly _desc: DistributorDesc,
	) {
		// Validate unit count and set validity, and regiser set validity
		const units = new Set(_desc.unitMap.map(({ groups }) => groups.map(({ lanes }) => lanes.map(({ ops }) => ops.map((x) => x)))).flat(3))
		const regs = new Set(_desc.regMap.flat())
		
		assert(units.size === _desc.units.length)

		for (let i = 0; i < units.size; i++) {
			assert(units.has(i))
		}

		for (let i = 0; i < regs.size; i++) {
			assert(regs.has(i))
		}

		// Generate units and registers
		this._units = _desc.units.map((desc) => ({ unit: new OperationalUnit(desc.op), queue: [] }))
		this._regs = [...Array(regs.size)].map(() => ({ tag: DataTag.Undefined }))
	}

	public step(decoded: (Instruction | undefined)[]): void {
		// Validate input has required decoder count
		assert(decoded.length === this._desc.unitMap.length)

		// Handle partial stalls
		if (this._desc.stallAll) {
			if (decoded.some((ins) => ins === undefined)) {
				return
			}
		}

		// Gather operations per unit
		const operations: Map<UnitIndex, DataValue[][]> = new Map()
		decoded.forEach((ins, decoderIndex) => {
			if (ins === undefined) {
				return
			}

			ins.groups.forEach((group, groupIndex) => {
				group.ops.forEach((op, laneIndex) => {
					const unitIndex = this._desc.unitMap[decoderIndex].groups[groupIndex].lanes[laneIndex].ops[op.opcode]

					const translatedArgs = this.translateArg(decoderIndex, op)

					const oldEntries = operations.get(unitIndex)
					if (oldEntries === undefined) {
						operations.set(unitIndex, [translatedArgs])
					} else {
						oldEntries.push(translatedArgs)
					}
				})
			})
		})

		// Apply merge strategies to each unit
		const mergedOps: Map<UnitIndex, [DataValue[], RegisterIndex]> = new Map()
		operations.forEach((args, unit) => {
			let argsOut: [DataValue[], RegisterIndex]

			const merge = this._desc.units[unit].merge
			switch (merge.tag) {
				case MergeTag.Error: {
					assert(args.length === 1)
					argsOut = [args[0], 0]
					break
				}
				case MergeTag.Queue: {
					const queue = this._units[unit].queue
					assert(queue.length + args.length - 1 <= merge.length)
					queue.push(...args)
					const [nextArgs] = queue.splice(0, 1)
					argsOut = [nextArgs, 0]
				}
			}

			mergedOps.set(unit, argsOut)
		})

		// Apply final result to each unit and get write back results
		const writeBack: Map<RegisterIndex, DataValue> = new Map()
		this._units.forEach(({ unit }, unitIndex) => {
			const args = mergedOps.get(unitIndex)
			const result = unit.step(args === undefined ? undefined : { args: args[0], target: args[1] })
			if (result !== undefined) {
				result.result.forEach((value, resultIndex) => {
					const target = result.target + resultIndex
					if (writeBack.has(target)) {
						throw new Error(`Attempt to write to register ${target} twice in the same cycle!`)
					}

					writeBack.set(target, value)
				})
			}
		})

		// Write back results to registers
		writeBack.forEach((value, reg) => {
			this._regs[reg] = value
		})
	}

	private translateArg(decoderIndex: number, op: Operation): DataValue[] {
		return op.args.map((arg) => {
			switch (arg.mode) {
				case ArgMode.Reg: {
					const regIndex = this._desc.regMap[decoderIndex][arg.index]
					assert(regIndex !== undefined)
					return this._regs[regIndex]
				}
			}
		})
	}
}
