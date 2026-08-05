import { ServiceUnavailableError } from "@/common/errors/app-error.ts"
import { aiRegistry } from "./ai.registry.ts"
import type { AICredentials } from "./ai.types.ts"

export const aiRouter = {
	resolve(credentials: AICredentials) {
		try {
			return aiRegistry.resolve(credentials.provider)
		} catch {
			throw new ServiceUnavailableError(
				`AI provider is not available: ${credentials.provider}`,
			)
		}
	},
}
