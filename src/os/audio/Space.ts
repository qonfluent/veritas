// An audio space is a volume in which a set of nodes have synchronized audio sources

import { Quaternion, RegularStream, TriangleMesh, Vector3 } from "../common/Common"
import { NormalizedGainMap } from "./GainMap"

// The audio space is responsible for converting virtual audio sources to physical audio sources
// Each space corresponds to an independent coordinate system
// If a physical audio source is shared between multiple spaces, it should perform a mix of the
// spaces' virtual audio sources before outputting to the physical audio source. The ratio of the
// mix should be set by the node's mixer.
export type AudioSpace = {
	virtualSources: VirtualAudioSource[]
	physicalSources: PhysicalAudioSource[]
	listeningVolume: ListeningVolume
	spatialModel: SpatialAudioModel
}

// A virtual audio source is a spherical pressure over time map emitted from a volume in space
export type VirtualAudioSource = {
	position: Vector3
	rotation: Quaternion
	data: RegularStream<NormalizedGainMap>
}

// A physical audio source is a physical speaker with a given position in space and measured spherical gain map
export type PhysicalAudioSource = {
	position: Vector3
	rotation: Quaternion
	gain: NormalizedGainMap
	output: RegularStream<number>
}

// A listening volume is an arbitrary volume in space in which the listener can hear
export type ListeningVolume = {
	position: Vector3
	rotation: Quaternion
	boundary: TriangleMesh
}

export type SpatialAudioModel = {
}
