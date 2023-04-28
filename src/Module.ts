import crypto from 'crypto'

export type ModuleID = string

export class Module {
	private readonly _id: ModuleID

	public constructor(
		private readonly _code: string,
	) {
		const hash = crypto.createHash('sha256').update(_code).digest('hex')
		this._id = `module/sha256-${hash}`
	}

	public get id(): ModuleID {
		return this._id
	}
	
	public get code(): string {
		return this._code
	}
}
