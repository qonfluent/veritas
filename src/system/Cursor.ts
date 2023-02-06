export class TextCursor {
	public constructor(
		public readonly text: string,
		private _index: number = 0,
	) {}

	public get done(): boolean {
		return this._index >= this.text.length
	}

	public get index(): number {
		return this._index
	}

	public get rest(): string {
		return this.text.substring(this.index)
	}

	public reset(index: number): void {
		this._index = index
	}

	public findNext(stops: string[]): [number, number] | undefined {
		let result: [number, number] | undefined = undefined
		for (let i = 0; i < stops.length; i++) {
			const stop = stops[i]
			const index = this.text.indexOf(stop, this.index)
			if (index >= 0 && (!result || index < result[0])) {
				result = [index, i]
			}
		}

		return result
	}

	public parseUntil(stops: string[]): string {
		const next = this.findNext(stops)
		if (!next) {
			const result = this.text.substring(this.index)
			this._index = this.text.length
			return result
		}

		const result = this.text.substring(this.index, next[0])
		this._index = next[0]
		return result
	}

	public startsWith(str: string, update: boolean): boolean {
		const result = this.text.startsWith(str, this.index)
		if (result && update) {
			this._index += str.length
		}

		return result
	}
}
