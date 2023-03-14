export type Stream<A> = { head: A[], tail?: () => Stream<A> }

export function empty<A>(): Stream<A> {
	return { head: [] }
}

export function singleton<A>(a: A): Stream<A> {
	return { head: [a] }
}

export function map<A, B>(stream: Stream<A>, f: (a: A) => B): Stream<B> {
	return stream.tail ? { head: stream.head.map(f), tail: () => map(stream.tail!(), f) } : { head: stream.head.map(f) }
}

export function merge<A>(...streams: Stream<A>[]): Stream<A> {
	if (streams.length === 0) return empty()
	if (streams.length === 1) return streams[0]
	if (streams.every(s => s.tail === undefined)) return { head: streams.flatMap((s) => s.head) }

	return {
		head: streams.flatMap((s) => s.head),
		tail: () => merge(...streams.map((s) => s.tail ? s.tail() : empty<A>())),
	}
}

export function bind<A>(stream: Stream<A>, f: (a: A) => Stream<A>): Stream<A> {
	const mapped = stream.head.map(f)
	if (mapped.every(s => s.tail === undefined)) return { head: mapped.flatMap((s) => s.head) }

	return {
		head: mapped.flatMap((s) => s.head),
		tail: () => merge(...mapped.map((s) => s.tail ? s.tail() : empty<A>())),
	}
}

export function take<A>(n: number, stream: Stream<A>): A[] {
	if (n <= 0) return []
	if (stream.tail === undefined) return stream.head.slice(0, n)
	return [...stream.head, ...take(n - stream.head.length, stream.tail())]
}
