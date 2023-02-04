import { Tag, TextParser } from '../src/system/Core'

describe('TextParser', () => {
	it('Parses a text document', () => {
		const parser = new TextParser('@', [' '], [','], [['(', ')', Tag.Text]])
		const value = parser.parse('Hello, (world)!')
		expect(value).toEqual({
			tag: Tag.Text,
			text: 'Hello, (world)!',
		})
	})

	it('Parses a command', () => {
		const parser = new TextParser('@', [' '], [','], [['(', ')', Tag.Text]])
		const value = parser.parse('@hello')
		expect(value).toEqual({
			tag: Tag.Command,
			command: 'hello',
			args: [],
		})
	})
})
