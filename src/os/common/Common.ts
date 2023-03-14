export type Vector3 = { x: number, y: number, z: number }
export type Quaternion = { x: number, y: number, z: number, w: number }
export type Timestamp = number
export type TimeDuration = number

// A regular stream is a stream with a fixed sample rate, starting at a fixed time
export type RegularStream<A> = {
	startTime: Timestamp
	sampleDuration: TimeDuration

	head: A[]
	tail: () => RegularStream<A>
}

export type TriangleMesh = {
	vertices: Vector3[]
	triangles: [number, number, number][]
}
