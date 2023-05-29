export type KeyPair = {
	publicKey: Uint8Array
	privateKey: Uint8Array
}

export type HashFn = (data: Uint8Array) => Uint8Array

export type SignatureVerifierFn = (publicKey: Uint8Array, data: Uint8Array, signature: Uint8Array) => boolean