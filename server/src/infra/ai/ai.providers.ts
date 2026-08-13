import { GeminiProvider } from "./providers/gemini.provider.ts"
import { aiRegistry } from "./ai.registry.ts"

let initialized = false

export function initializeAIProviders(): void {
	if (initialized) return
	for (const provider of [new GeminiProvider()])
		aiRegistry.register(provider)
	initialized = true
}
