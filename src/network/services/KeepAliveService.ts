import { Ref, TimeDuration, TimeInstant } from '../../Utility'
import { IConnection } from '../Connection'
import { IService } from '../Service'

export type PingMessage = {}
export type PongMessage = {}

export type KeepAliveStats = {
	// The time the last ping was sent
	lastPing: TimeInstant

	// The time the last pong was received
	lastPong: TimeInstant
}

export interface IKeepAliveService extends IService {
	get timeout(): TimeDuration
	stat(connection: Ref<IConnection>): KeepAliveStats
}
