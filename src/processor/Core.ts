import { GWModule } from 'gateware-ts'
import { CoreDesc } from './Description'

export class CoreModule extends GWModule {
	public constructor(
		name: string,
		private readonly _desc: CoreDesc,
	) {
		super(name)
	}

	public describe(): void {
		
	}
}
