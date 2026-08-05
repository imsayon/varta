import { prisma } from "@/infra/database/prisma.ts"
import { decrypt } from "@/common/utils/crypto.util.ts"
import { env } from "@/common/config/env.ts"
import { ServiceUnavailableError } from "@/common/errors/app-error.ts"
import type { AICredentials } from "./ai.types.ts"
import { AI_PROVIDERS } from "./ai.constants.ts"

export const aiCredentials = {
	async resolve(workspaceId: string): Promise<AICredentials> {
		const workspaceConfig = await prisma.workspaceAiConfig.findUnique({
			where: { workspaceId },
		})
		if (workspaceConfig?.isEnabled) {
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
