import { TypedEmitter } from "tiny-typed-emitter"

export type MessageID = string
export type Message = {
	issuer: ProcessID
	audience: ProcessID
	proof: MessageID[]
}

export type ModuleID = string
export type PlatformID = string
export type Module = {
	platform: PlatformID
	code: Uint8Array
}

export type ProcessID = string
export interface ProcessEvents {
	'message': (msg: Message) => void
	'error': (err: Error) => void
	'kill': () => void
}
export interface IProcess extends TypedEmitter<ProcessEvents> {
	kill(): Promise<void>
	send(...msgs: Message[]): Promise<void>
}

export interface IComputeProvider {
	get processes(): Promise<Map<ProcessID, IProcess>>
	
	spawn(module: Module): Promise<IProcess>
	get(id: ProcessID): Promise<IProcess | undefined>
	kill(id: ProcessID): Promise<void>
	killAll(): Promise<void>
}
