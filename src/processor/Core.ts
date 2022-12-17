import { GWModule } from 'gateware-ts'
import { DecoderModule } from './Decoder'
import { CoreDesc } from './Description'

export class CoreModule extends GWModule {
	private _decoders: DecoderModule[]

	public constructor(
		name: string,
		private readonly _desc: CoreDesc,
	) {
		super(name)

		this._decoders = _desc.decoders.map((desc, i) => new DecoderModule(`decoder_${i}`, desc, _desc.units, _desc.argInfo))
	}

	public describe(): void {
		
	}
}
