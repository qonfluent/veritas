import { IConnection } from '../network/Connection'
import { Ref, Service } from '../Utility'
import { IService } from '../Service'

export type VerificationMethodOrRef = Ref<VerificationMethod> | VerificationMethod

export type Identity = {
	id: Ref<Identity>
	alsoKnownAs: Ref<Identity>[]
	controller: Ref<Identity>[]
	verificationMethod: VerificationMethod[]
	authentication: VerificationMethodOrRef[]
	assertionMethod: VerificationMethodOrRef[]
	keyAgreement: VerificationMethodOrRef[]
	capabilityInvocation: VerificationMethodOrRef[]
	capabilityDelegation: VerificationMethodOrRef[]
	service: Endpoint[]
}

export type VerificationMethodHeader = {
	id: Ref<VerificationMethod>
	type: string
	controller: Ref<Identity>[]
}

export type PublicKeyVerificationMethod = VerificationMethodHeader & { publicKey: Uint8Array }
export type AndConditionVerificationMethod = VerificationMethodHeader & { conditionAnd: VerificationMethodOrRef[] }
export type OrConditionVerificationMethod = VerificationMethodHeader & { conditionOr: VerificationMethodOrRef[] }
export type ThresholdConditionVerificationMethod = VerificationMethodHeader & { conditionThreshold: VerificationMethodOrRef[], threshold: number }
export type WeightedThresholdConditionVerificationMethod = VerificationMethodHeader & { conditionWeightedThreshold: { condition: VerificationMethodOrRef, weight: number }[] }

export type VerificationMethod
	= PublicKeyVerificationMethod
	| AndConditionVerificationMethod
	| OrConditionVerificationMethod
	| ThresholdConditionVerificationMethod
	| WeightedThresholdConditionVerificationMethod

export type Endpoint = {
	id: Ref<Endpoint>
	type: string
	serviceEndpoint: ServiceEndpoint
}

export type ServiceEndpoint
	= Ref<Service> // Service has one endpoint
	| Ref<Service>[] // Service has many endpoints for load balancing
	| { [purpose: string]: ServiceEndpoint } // Service has many endpoints for different purposes

export type IdentityRequestMessage = {}

export type IdentityResponseMessage = {
	identity: Identity
}

export interface IIdentityService extends IService {
	// Get the identity of a connection
	getIdentity(connection: Ref<IConnection>): Promise<Identity>
}