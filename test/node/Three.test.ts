// A reference is an array of bytes to be interpreted by the resolver
export type Ref<T> = string

// A DataRef is a reference to anything
export type DataRef = Ref<any>

// A DID is a Ref to a IdentityDocument
export type DID = Ref<IdentityDocument>

export type DIDURL = Ref<IdentityEndpoint>

export type IdentityDocument = {
	id: DID
	alsoKnownAs?: DID[]
	controller?: DID[]
	verificationMethod?: VerificationMethod[]
	authentication?: (VerificationMethod | DIDURL)[]
	assertionMethod?: (VerificationMethod | DIDURL)[]
	keyAgreement?: (VerificationMethod | DIDURL)[]
	capabilityDelegation?: (VerificationMethod | DIDURL)[]
	capabilityInvocation?: (VerificationMethod | DIDURL)[]
	service?: IdentityEndpoint[]
}

export type VerificationMethod = {
	id: DIDURL
	type: string
	controller: DID
	publicKey: string
}

export type EndpointSelector = DataRef | EndpointSelector[] | { [key: string]: EndpointSelector }

export type IdentityEndpoint = {
	id: DataRef
	type: string
	serviceEndpoint: EndpointSelector
}

export type IdentityDocumentMetadata = {
	created: LocalizedInstant
	updated: LocalizedInstant
	deactivated: LocalizedInstant
	nextUpdate: LocalizedInstant
	versionId: string
	nextVersionId: string
	equivalentId: DID[]
	canonicalId: DID
}

export type Clock = {
	now(): Instant
}

export type Instant = {
	secondsSinceEpoch: number
	fractionalSeconds: number
	fractionalSecondsPrecision: number
}

export type LocalizedInstant = {
	clock: Ref<Clock>
	instant: Instant
}

export type Ability = string

export type UCAN = {
	issuer: DID
	audience: DID

	issuedAt?: LocalizedInstant
	notBefore?: LocalizedInstant
	expiresAt?: LocalizedInstant | null

	nonce?: string
	facts?: Record<string, any>
	capabilities: Record<string, Record<Ability, object[]>>
	attenuations?: Record<string, Record<Ability, object[]>>
	proofs?: Ref<UCAN>[]

	signature: string
}

export type Task = {
	on: DataRef
	call: Ability
	input: Record<string, any>
}

export type Invocation = {
	task: Task
	cause: Ref<Receipt>
	auth: Ref<UCAN>
}

export type Receipt = {
	issuer: DID
	ran: Ref<Invocation>
	out: { error: any } | { ok: any }
	effects: Effects
	proofs: Ref<UCAN>[]
	signature: string
}

export type Effects = {
	// Wait for these invocations to start before continuing
	forks: Ref<Invocation>[]
	
	// Continue with these invocations
	joins: Ref<Invocation>[]
}

export type Await = {
	tag: 'await/*' | 'await/ok' | 'await/error'
	task: Ref<Task>
}

export type Session = {
	
}

// To connect to a target given its DID
// 1. Resolve the DID, getting the IdentityDocument
// 2. Connect to the IdentityDocument's serviceEndpoint
// 3. Send a ConnectMessage to the serviceEndpoint, getting a PreSession back
// 4. Send a SessionMessage to the serviceEndpoint, getting a Session back
// 4. Session now allows for sending messages to the target

// Connect message is like the first packet of an SCTP handshake
export type Message = {
	issuer: DID
	audience: DID
	nonce: string
	chunks: MessageChunk[]
}

// TLV encoded message chunk
export type MessageChunk = {
	type: string
	data: string
}
