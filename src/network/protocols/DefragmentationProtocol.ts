import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type DefragmentationOptions = {
	// The maximum size of a fragment
	maxFragmentSize: number
}
export interface IDefragmentationProtocol extends IProtocol<DefragmentationOptions, IDefragmentedConnection> {}
export interface IDefragmentedConnection extends IConnection {}
