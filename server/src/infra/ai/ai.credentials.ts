import { prisma } from "@/infra/database/prisma.ts"
import { decrypt } from "@/common/utils/crypto.util.ts"
import { env } from "@/common/config/env.ts"
import { ServiceUnavailableError } from "@/common/errors/app-error.ts"
import type { AICredentials } from "./ai.types.ts"
import { AI_PROVIDERS, AI_PROVIDER_MODELS } from "./ai.constants.ts"

// E2: Validate that the resolved provider/model combination is on the allowlist.
// The openai-compatible provider bypasses the model allowlist (caller-supplied endpoint).
function validateProviderModel(provider: string, model: string): void {
	if (provider === AI_PROVIDERS.OPENAI_COMPATIBLE) return
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
			// BYOK: workspace supplies its own provider/model/key.
			// Validate against allowlist before returning; tenant isolation is enforced by the workspaceId lookup.
			validateProviderModel(workspaceConfig.provider, workspaceConfig.model)
			return {
				provider: workspaceConfig.provider,
				model: workspaceConfig.model,
				apiKey: decrypt(workspaceConfig.encryptedApiKey),
				...(workspaceConfig.baseUrl
					? { baseUrl: workspaceConfig.baseUrl }
					: {}),
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
		if (
			env.AI_PLATFORM_PROVIDER === AI_PROVIDERS.OPENAI_COMPATIBLE &&
			!env.AI_PLATFORM_BASE_URL
		) {
			throw new ServiceUnavailableError(
				"AI_PLATFORM_BASE_URL is required for the openai-compatible provider",
			)
		}
		// Platform key: validate allowlist for non-compatible providers.
		validateProviderModel(env.AI_PLATFORM_PROVIDER, env.AI_PLATFORM_MODEL)
		return {
			provider: env.AI_PLATFORM_PROVIDER,
			model: env.AI_PLATFORM_MODEL,
			apiKey: env.AI_PLATFORM_API_KEY,
			...(env.AI_PLATFORM_BASE_URL
				? { baseUrl: env.AI_PLATFORM_BASE_URL }
				: {}),
		}
	},
}
