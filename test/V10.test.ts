import { decodeDID, decodeDIDURL, decodeURI } from "../src/storage/Identity"

export type Var = number
export type Lit = string
export type Value = Var | Lit | Value[]

export enum PTag {
	Top,
	Bot,
	Eq,
	Call,
	Not,
	ChAnd,
	ChOr,
	ChAll,
	ChExists,
	ChImpl,
	ParAnd,
	ParOr,
	ParAll,
	ParExists,
	ParImpl,
	SeqAnd,
	SeqOr,
	SeqAll,
	SeqExists,
	SeqImpl,
	TogAnd,
	TogOr,
	TogAll,
	TogExists,
	TogImpl,
	BlindAll,
	BlindExists,
	ParRec,
	SeqRec,
	TogRec,
	BrRec,
	ParCoRec,
	SeqCoRec,
	TogCoRec,
	BrCoRec,
	ParRecImpl,
	SeqRecImpl,
	TogRecImpl,
	BrRecImpl,
	ParRecRef,
	SeqRecRef,
	TogRecRef,
	BrRecRef,
}

export type Sym = string
export type Protocol
	= { tag: PTag.Top }
	| { tag: PTag.Bot }
	| { tag: PTag.Eq, lhs: Value, rhs: Value }
	| { tag: PTag.Call, func: Sym, args: Value[] }
	| { tag: PTag.Not, body: Protocol }
	| { tag: PTag.ChAnd | PTag.ParAnd | PTag.SeqAnd | PTag.TogAnd | PTag.ChOr | PTag.ParOr | PTag.SeqOr | PTag.TogOr, args: Protocol[] }
	| { tag: PTag.ChAll | PTag.ParAll | PTag.SeqAll | PTag.TogAll | PTag.BlindAll | PTag.ChExists | PTag.ParExists | PTag.SeqExists | PTag.TogExists | PTag.BlindExists, body: Protocol }
	| { tag: PTag.ChImpl | PTag.ParImpl | PTag.SeqImpl | PTag.TogImpl, lhs: Protocol, rhs: Protocol }
	| { tag: PTag.ParRec | PTag.SeqRec | PTag.TogRec | PTag.BrRec | PTag.ParCoRec | PTag.SeqCoRec | PTag.TogCoRec | PTag.BrCoRec, body: Protocol }
	| { tag: PTag.ParRecImpl | PTag.SeqRecImpl | PTag.TogRecImpl | PTag.BrRecImpl | PTag.ParRecRef | PTag.SeqRecRef | PTag.TogRecRef | PTag.BrRecRef, body: Protocol }

describe('Identity', () => {
	it('URIs', () => {
		const t0 = decodeURI('https://bob:password@www.example.com:1234/identity/0?q=0&f=1#asdf')
		expect(t0).toEqual({
			scheme: 'https',
			authority: {
				user: 'bob',
				password: 'password',
				host: 'www.example.com',
				port: 1234,
			},
			path: '/identity/0',
			query: new Map([
				['q', '0'],
				['f', '1'],
			]),
			fragment: 'asdf',
		})

		const t1 = decodeURI('mailto:bob@gmail.com')
		expect(t1).toEqual({
			scheme: 'mailto',
			authority: undefined,
			path: 'bob@gmail.com',
			query: undefined,
			fragment: undefined,
		})
	})

	it('DIDs', () => {
		const t0 = decodeDID('did:example:0')
		expect(t0).toEqual({
			scheme: 'did',
			method: 'example',
			id: '0',
		})
	})

	it('DID URIs', () => {
		const t0 = decodeDIDURL('did:example:0/path/0?q=0&f=1#asdf')
		expect(t0).toEqual({
			scheme: 'did',
			method: 'example',
			id: '0',
			path: '/path/0',
			query: new Map([
				['q', '0'],
				['f', '1'],
			]),
			fragment: 'asdf',
		})
	})
})
