export function rangeMap<T>(count: number, f: (i: number) => T): T[] {
	return [...Array(count)].map((_, i) => f(i))
}

export function partition<T>(xs: T[], pred: (a: T) => boolean): [T[], T[]] {
	return xs.reduce(([lhs, rhs], entry) => pred(entry) ? [lhs, [...rhs, entry]] : [[...lhs, entry], rhs], [[], []] as [T[], T[]])
}
