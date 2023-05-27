import { IComputeManager, IStorageManager, INetworkManager } from './Managers'

export interface ISystem {
	compute: IComputeManager
	storage: IStorageManager
	network: INetworkManager
}
