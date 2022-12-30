export function clog2(n: number): number {
	return n > 0 ? Math.ceil(Math.log2(n)) : 0
}

export function rangeMap<T>(n: number, f: (i: number) => T): T[] {
	return [...Array(n)].map((_, i) => f(i))
}

export function partition<T>(xs: T[], selector: (x: T) => boolean): [T[], T[]] {
	return xs.reduce<[T[], T[]]>(([a, b], x) => selector(x) ? [[...a, x], b] : [a, [...b, x]], [[], []])
}
