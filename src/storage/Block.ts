import { concat, encodeVarnat, decodeVarnat } from "./Encoding"

export type BlockId = Uint8Array
export type SymmetricKey = Uint8Array

export type Link<T> = {
	data: T
	block: BlockId
	key: SymmetricKey
}

export type Block<T> = {
	data: T
	links: Link<T>[]
}

export function encodeBlockBytes<T>(block: Block<T>, encode: (t: T) => Uint8Array): Uint8Array {
	const data = encode(block.data)
	const links = block.links.map((link) => {
		const data = encode(link.data)
		return concat(
			encodeVarnat(data.length), data,
			encodeVarnat(link.block.length), link.block,
			encodeVarnat(link.key.length), link.key,
		)
	})

	return concat(
		encodeVarnat(data.length), data,
		encodeVarnat(links.length), ...links,
	)
}

export function decodeBlockBytes<T>(data: Uint8Array, decode: (data: Uint8Array) => T): [Block<T>, number] {
	const [dataLength, initOffset] = decodeVarnat(data)
	let offset = initOffset
	const blockData = decode(data.slice(offset, offset + dataLength))
	offset += dataLength

	const [linksLength, linksOffset] = decodeVarnat(data.slice(offset))
	offset += linksOffset
	const links: Link<T>[] = []
	for (let i = 0; i < linksLength; i++) {
		const [linkDataLength, linkDataOffset] = decodeVarnat(data.slice(offset))
		offset += linkDataOffset
		const linkData = decode(data.slice(offset, offset + linkDataLength))
		offset += linkDataLength

		const [blockLength, blockOffset] = decodeVarnat(data.slice(offset))
		offset += blockOffset
		const block = data.slice(offset, offset + blockLength)
		offset += blockLength

		const [keyLength, keyOffset] = decodeVarnat(data.slice(offset))
		offset += keyOffset
		const key = data.slice(offset, offset + keyLength)
		offset += keyLength

		links.push({ data: linkData, block, key })
	}

	return [{ data: blockData, links }, offset + initOffset]
}
