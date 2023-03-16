export function rangeMap<T>(count: number, f: (i: number) => T): T[] {
	return [...Array(count)].map((_, i) => f(i))
}

export function remove<T>(arr: T[], i: number): T[] {
	return arr.slice(0, i).concat(arr.slice(i + 1))
}
