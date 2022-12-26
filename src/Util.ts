export function rangeMap<V>(n: number, body: (i: number) => V): V[] {
	return [...Array(n)].map((_, i) => body(i))
}

export function rangeFlatMap<V>(n: number, body: (i: number) => V[]): V[] {
	return [...Array(n)].flatMap((_, i) => body(i))
}

export function recordRangeMap<V>(n: number, body: (i: number) => [string | number, V]): Record<string | number, V> {
	return Object.fromEntries([...Array(n)].map((_, i) => body(i)))
}

export function recordRangeFlatMap<V>(n: number, body: (i: number) => [string | number, V][]): Record<string | number, V> {
	return Object.fromEntries([...Array(n)].flatMap((_, i) => body(i)))
}

export function clog2(n: number): number {
	return n === 0 ? 0 : Math.ceil(Math.log2(n))
}
