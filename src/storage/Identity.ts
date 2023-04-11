export type URIScheme = {
	scheme: string
}

export type URI = URIScheme & {
	authority?: {
		user?: string
		password?: string
		host: string
		port?: number
	}
	path: string
	query?: Map<string, string>
	fragment?: string
}

export function decodeURI(uri: string): URI {
	const data = new URL(uri)

	const authority = data.username || data.password || data.host || data.port ? {
		user: data.username === '' ? undefined : data.username,
		password: data.password === '' ? undefined : data.password,
		host: data.hostname,
		port: data.port ? parseInt(data.port) : undefined,
	} : undefined
	
	return {
		scheme: data.protocol.slice(0, -1),
		authority,
		path: data.pathname,
		query: data.search ? new Map(data.searchParams) : undefined,
		fragment: data.hash === '' ? undefined : data.hash.slice(1),
	}
}

export type DID = URIScheme & {
	method: string
	id: string
}

export function decodeDID(did: string): DID {
	const uri = decodeURI(did)
	if (uri.scheme !== 'did') throw new Error('Invalid DID scheme')
	if (uri.authority) throw new Error('Invalid DID authority')
	if (uri.query) throw new Error('Invalid DID query')
	if (uri.fragment) throw new Error('Invalid DID fragment')

	const colonIndex = uri.path.indexOf(':')
	if (colonIndex === -1) throw new Error('Invalid DID path')

	return {
		scheme: uri.scheme,
		method: uri.path.slice(0, colonIndex),
		id: uri.path.slice(colonIndex + 1),
	}
}

export type DIDURI = DID & {
	path: string
	query?: Map<string, string>
	fragment?: string
}

export function decodeDIDURI(didurl: string): DIDURI {
	const uri = decodeURI(didurl)
	if (uri.scheme !== 'did') throw new Error('Invalid DIDURI scheme')
	if (uri.authority) throw new Error('Invalid DIDURI authority')

	const colonIndex = uri.path.indexOf(':')
	if (colonIndex === -1) throw new Error('Invalid DIDURI path')

	const slashIndex = uri.path.indexOf('/', colonIndex + 1)
	if (slashIndex === -1) throw new Error('Invalid DIDURI path')

	return {
		scheme: uri.scheme,
		method: uri.path.slice(0, colonIndex),
		id: uri.path.slice(colonIndex + 1, slashIndex),
		path: uri.path.slice(slashIndex),
		query: uri.query,
		fragment: uri.fragment,
	}
}

export type DIDDocument = {
	id: DID
	alsoKnownAs?: DID[]
	controller?: DID[]
	verificationMethod?: VerificationMethod[]
	authentication?: VerificationMethodOrDIDURI[]
	assertionMethod?: VerificationMethodOrDIDURI[]
	keyAgreement?: VerificationMethodOrDIDURI[]
	capabilityInvocation?: VerificationMethodOrDIDURI[]
	capabilityDelegation?: VerificationMethodOrDIDURI[]
	service?: ServiceEndpoint[]
}

export type VerificationMethod = {
	id: DIDURI
	controller: DID
	type: string
	publicKey?: string
}

export type VerificationMethodOrDIDURI = VerificationMethod | DIDURI

export type ServiceEndpoint = {
	id: DIDURI
	type: string | string[]
	serviceEndpoint: URI | URI[] | Map<string, URI>
}

export type Timestamp = string

export type DIDDocumentMetadata = {
	created?: Timestamp
	updated?: Timestamp
	deactivated?: boolean
	nextUpdate?: Timestamp
	versionId?: string
	nextVersionId?: string
	equivalentId?: DID[]
	canonicalId?: DID
}

export type UCAN = {
	issuer: DID
	audience: DID
	startTime?: Timestamp
	endTime?: Timestamp
	nonce: string
	resources: URI[]
	delegations?: URI[]
	attenuations?: URI[]
}


