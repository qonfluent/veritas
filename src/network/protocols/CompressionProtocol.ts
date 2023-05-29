import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'

export type CompressionOptions = {
	// The maximum size of a fragment
	maxFragmentSize: number
}
export interface ICompressionProtocol extends IProtocol<CompressionOptions, ICompressedConnection> {}
export interface ICompressedConnection extends IConnection {}
