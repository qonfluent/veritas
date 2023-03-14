// A normalized gain map is a gain map with equally spaced measurement points in a 2D grid
export type NormalizedGainMap = {
	normalized: true
	gains: number[][]
}

// A gain map is a set of measured gains at a set of points
export type GainMapEntry
	= { cartesian: false, theta: number, phi: number, radius: number, gain: number }
	| { cartesian: true, x: number, y: number, z: number, gain: number }

export type GainMap = GainMapEntry[]

export function normalizeGainMap(gainMap: GainMap): NormalizedGainMap {
	throw new Error('Not implemented')
}
