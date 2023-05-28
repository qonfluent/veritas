export type TimeInstant = number
export type TimeInterval = [TimeInstant, TimeInstant]

export function bytesToString(bytes: Uint8Array): string {
	return `m${Buffer.from(bytes).toString('base64')}`
}
