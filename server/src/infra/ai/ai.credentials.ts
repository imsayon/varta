import { prisma } from "@/infra/database/prisma.ts"
import { decrypt } from "@/common/utils/crypto.util.ts"
import { env } from "@/common/config/env.ts"
import { ServiceUnavailableError } from "@/common/errors/app-error.ts"
import type { AICredentials } from "./ai.types.ts"
import { AI_PROVIDERS, AI_PROVIDER_MODELS } from "./ai.constants.ts"

function validateProviderModel(provider: string, model: string): void {
	if (provider !== AI_PROVIDERS.GEMINI) {
		throw new ServiceUnavailableError("Only Gemini is enabled for the Phase E production launch")
	}
	const allowedModels = AI_PROVIDER_MODELS[provider]
	if (!allowedModels) {
		throw new ServiceUnavailableError(`AI provider is not on the allowlist: ${provider}`)
	}
	if (!allowedModels.includes(model)) {
		throw new ServiceUnavailableError(
			`AI model '${model}' is not on the allowlist for provider '${provider}'`,
		)
	}
}

export const aiCredentials = {
	async resolve(workspaceId: string): Promise<AICredentials> {
		const workspaceConfig = await prisma.workspaceAiConfig.findUnique({
			where: { workspaceId },
		})
		if (workspaceConfig?.isEnabled) {
			validateProviderModel(workspaceConfig.provider, workspaceConfig.model)
			if (workspaceConfig.baseUrl) {
				throw new ServiceUnavailableError("Custom AI provider URLs are not permitted")
			}
			return {
				provider: workspaceConfig.provider,
				model: workspaceConfig.model,
				apiKey: decrypt(workspaceConfig.encryptedApiKey),
			}
		}
		if (
			!env.AI_PLATFORM_PROVIDER ||
			!env.AI_PLATFORM_MODEL ||
			!env.AI_PLATFORM_API_KEY
		) {
			throw new ServiceUnavailableError(
				"AI platform credentials are not configured",
			)
		}
		validateProviderModel(env.AI_PLATFORM_PROVIDER, env.AI_PLATFORM_MODEL)
		return {
			provider: env.AI_PLATFORM_PROVIDER,
			model: env.AI_PLATFORM_MODEL,
			apiKey: env.AI_PLATFORM_API_KEY,
		}
	},
}
