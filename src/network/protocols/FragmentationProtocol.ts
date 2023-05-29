import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type FragmentationOptions = {
	// The maximum size of a fragment
	maxFragmentSize: number
}
export interface IFragmentationProtocol extends IProtocol<FragmentationOptions, IFragmentedConnection> {}
export interface IFragmentedConnection extends IConnection {}
