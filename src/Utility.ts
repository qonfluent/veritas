// Reference types for the network
export type Ref<T> = Uint8Array

// A location is a ref tag used to identify a specific location in the network
export class Location {}

// A service is a ref tag used to identify a specific service on a specific endpoint in the network
export class Service {}

// A specific moment in absolute time
export type TimeInstant = number

// A duration absolute time
export type TimeDuration = number

// A time interval between two time instants
export type TimeInterval = [TimeInstant, TimeInstant]

export function bytesToString(bytes: Uint8Array): string {
	return `m${Buffer.from(bytes).toString('base64')}`
}
