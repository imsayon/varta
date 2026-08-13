import type { AIProvider } from "./providers/ai-provider.interface.ts"

const providers = new Map<string, AIProvider>()

export const aiRegistry = {
	register(provider: AIProvider) {
		if (providers.has(provider.name))
			throw new Error(`AI provider already registered: ${provider.name}`)
		providers.set(provider.name, provider)
	},
	resolve(name: string): AIProvider {
		const provider = providers.get(name)
		if (!provider) throw new Error(`AI provider is not registered: ${name}`)
		return provider
	},
}
