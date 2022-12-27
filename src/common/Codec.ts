export interface Codec<S, T> {
	encode(s: S): T
	decode(t: T): S
}
