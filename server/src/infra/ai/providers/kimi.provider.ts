import { OpenAICompatibleProvider } from "./openai-compatible.provider.ts"
import { AI_PROVIDER_ENDPOINTS, AI_PROVIDERS } from "../ai.constants.ts"

export class KimiProvider extends OpenAICompatibleProvider {
	constructor() {
		super(AI_PROVIDERS.KIMI, AI_PROVIDER_ENDPOINTS.KIMI)
	}
}
