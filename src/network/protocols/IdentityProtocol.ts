import { IConnection } from '../Connection'
import { IProtocol } from '../Protocol'
import { Ref, Service } from '../Ref'

export type Identity = {
	id: Ref<Identity>
	alsoKnownAs: Ref<Identity>[]
	controller: Ref<Identity>[]
	verificationMethod: VerificationMethod[]
	authentication: (Ref<VerificationMethod> | VerificationMethod)[]
	assertionMethod: (Ref<VerificationMethod> | VerificationMethod)[]
	keyAgreement: (Ref<VerificationMethod> | VerificationMethod)[]
	capabilityInvocation: (Ref<VerificationMethod> | VerificationMethod)[]
	capabilityDelegation: (Ref<VerificationMethod> | VerificationMethod)[]
	service: Endpoint[]
}

export type VerificationMethod = {
	id: Ref<VerificationMethod>
	type: string
	controller: Ref<Identity>[]
	publicKey: Uint8Array
}

export type Endpoint = {
	id: Ref<Endpoint>
	type: string
	serviceEndpoint: ServiceEndpoint
}

export type ServiceEndpoint
	= Ref<Service> // Service has one endpoint
	| Ref<Service>[] // Service has many endpoints for load balancing
	| { [purpose: string]: ServiceEndpoint } // Service has many endpoints for different purposes

export type IdentityOptions = {
	// The local identity
	localIdentity: Identity
}

export interface IIdentityProtocol extends IProtocol<IdentityOptions, IIdentifiedConnection> {}

export interface IIdentifiedConnection extends IConnection {
	get localIdentity(): Identity
	get remoteIdentity(): Identity
}
