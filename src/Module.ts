import crypto from 'crypto'
import { ID, Message } from './Common'

export class ModuleID implements ID {
	public constructor(
		private readonly _id: string,
	) {}

	public toString(): string {
		return `module/${this._id}`
	}
}

export class Module {
	private readonly _id: ModuleID

	public constructor(
		private readonly _code: string,
	) {
		const hash = crypto.createHash('sha256').update(_code).digest('hex')
		this._id = new ModuleID(`sha256-${hash}`)
	}

	public get id(): ModuleID {
		return this._id
	}
	
	public get code(): string {
		return this._code
	}
}
