export function clog2(n: number): number {
	return n > 0 ? Math.ceil(Math.log2(n)) : 0
}

export function rangeMap<T>(n: number, f: (i: number) => T): T[] {
	return [...Array(n)].map((_, i) => f(i))
}
