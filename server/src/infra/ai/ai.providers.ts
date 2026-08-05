import { AnthropicProvider } from "./providers/anthropic.provider.ts"
import { GeminiProvider } from "./providers/gemini.provider.ts"
import { KimiProvider } from "./providers/kimi.provider.ts"
import { OpenAIProvider } from "./providers/openai.provider.ts"
import { OpenAICompatibleProvider } from "./providers/openai-compatible.provider.ts"
import { aiRegistry } from "./ai.registry.ts"
import { AI_PROVIDERS } from "./ai.constants.ts"

let initialized = false

export function initializeAIProviders(): void {
	if (initialized) return
	for (const provider of [
		new GeminiProvider(),
		new OpenAIProvider(),
		new AnthropicProvider(),
		new KimiProvider(),
		new OpenAICompatibleProvider(AI_PROVIDERS.OPENAI_COMPATIBLE, ""),
	])
		aiRegistry.register(provider)
	initialized = true
}
