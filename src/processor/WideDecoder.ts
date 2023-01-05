import { Module } from '../hdl/Module'

export type WiderDecoderArgs = {
	widths: number[]
	join: boolean
	min: number
}

export type WideDecoderTree = {
	groups: WiderDecoderArgs[][]
}

export function createWideDecoderTree(desc: WideDecoderTree): Module {
	void desc
	throw new Error('Not implemented')
}
