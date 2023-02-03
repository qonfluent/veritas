/*
export type FileInfo = {
	// The length of the file in bytes
	length: number
}

export type ByteSpan = {
	start: number
	length: number
}

export enum MonitorType {
	// Monitors for changes to the file's length
	Length = 0x01,

	// Monitors for changes to the file's content
	Content = 0x02,
}

export type MonitorRequest = {
	// The type of monitor to create, as a bitfield
	type: MonitorType

	// The span to monitor over, in bytes
	span?: ByteSpan
} & ({
	// The length of the file at the time of the request
	// NOTE: For set spans, this will detect inserts and deletes
	//       For unset spans, this will detect any change to the file's length
	type: MonitorType.Length,
} | {
	// The hash of the file at the time of the request
	hash: IHashValue
})

export type MonitorResponse = {
	length: number
}

export type BytesReadCB = (err?: Error, data?: Uint8Array) => void
export type PossibleErrorCB = (err?: Error) => void
export type FileInfoCB = (err?: Error, stats?: FileInfo) => void
export type MonitorCB = (err?: Error, stats?: MonitorResponse) => void

export interface INamed {
	get name(): Identifier
}

export interface IFile extends INamed {
	read(offset: number, length: number, cb: BytesReadCB): void
	write(offset: number, data: Uint8Array, cb?: PossibleErrorCB): void
	delete(offset: number, length: number, cb?: PossibleErrorCB): void
	truncate(length: number, cb?: PossibleErrorCB): void
	close(cb?: PossibleErrorCB): void
}

export interface IFileFactory extends INamed {
	create(identifier: Identifier, cb: (err?: Error, file?: IFile) => void): void
	open(identifier: Identifier, cb: (err?: Error, file?: IFile) => void): void
	info(identifier: Identifier, cb: FileInfoCB): void
	delete(identifier: Identifier, cb?: PossibleErrorCB): void
	monitor(identifier: Identifier, req: MonitorRequest, cb: MonitorCB): void
}

export class IAtSyntax extends  {}

export class Identifier extends IAtSyntax {}

describe('Core storage layer', () => {
	describe('File', () => {
	})
})
*/