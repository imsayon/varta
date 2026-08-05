import type { AIProviderRequest, AIProviderResponse } from "../ai.types.ts"

export interface AIProvider {
	readonly name: string
	generate(request: AIProviderRequest): Promise<AIProviderResponse>
}
