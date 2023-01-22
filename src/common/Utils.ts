export function clog2(x: number): number {
	return x === 0 ? 0 : Math.ceil(Math.log2(x))
}
