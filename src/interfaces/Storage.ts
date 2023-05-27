export type ContentID = string
export type CodecID = ContentID
export type HashID = ContentID

export type GetOptions = {
	start?: number
	end?: number
}

export type PutOptions = {
	codec?: CodecID
	hash?: HashID
}

export interface IStorageProvider {
	get(id: ContentID, opt?: GetOptions): Promise<Uint8Array>
	put(data: Uint8Array, opt?: PutOptions): Promise<ContentID>
}
