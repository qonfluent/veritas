import { Name, Value } from "../AST"

export function mergeEnvironments(...envs: Record<Name, Value>[]): Record<Name, Value> {
	const result: Record<Name, Value> = {}
	for (const env of envs) {
		for (const name in env) {
			if (result[name] !== undefined) {
				throw new Error(`Name conflict: ${name}`)
			}

			result[name] = env[name]
		}
	}

	return result
}
