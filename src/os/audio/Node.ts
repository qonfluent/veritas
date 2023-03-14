import { NetworkLocation } from '../net/Network'
import { AudioDevice } from './Device'
import { AudioSpace } from './Space'

// An audio node is a member of the cluster that can modify a set of shared audio spaces
// Each audio space has a network location, and each audio node has a set of neghiboring audio nodes
// The neghiboring audio nodes are the audio nodes that have some shared audio spaces with this node
// Connection must be maintained between all audio nodes to ensure that all audio spaces are synchronized
// Each physical computer should run one audio node if it has any physical audio sources attached to it

// A node also has an attached set of audio devices which are mapped to the audio spaces using a mixer function
// For each device, there is a network path for the device, a mixer function which takes the output of each audio space
// and mixes it into a single stream
export type AudioNode = {
	audioSpaces: Record<NetworkLocation<AudioSpace>, AudioSpace>
	neghibors: NetworkLocation<AudioNode>[]
	devices: {
		path: NetworkLocation<AudioDevice>
	}[]
}
