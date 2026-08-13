import { OpenAICompatibleProvider } from "./openai-compatible.provider.ts"
import { AI_PROVIDER_ENDPOINTS, AI_PROVIDERS } from "../ai.constants.ts"

export class OpenAIProvider extends OpenAICompatibleProvider {
	constructor() {
		super(AI_PROVIDERS.OPENAI, AI_PROVIDER_ENDPOINTS.OPENAI)
	}
}
