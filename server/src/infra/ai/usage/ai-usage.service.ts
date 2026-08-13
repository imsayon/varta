import { logger } from "@/infra/observability/logger.ts"
import { env } from "@/common/config/env.ts"
import { aiUsageRepository } from "./ai-usage.repository.ts"
import type { AIUsageRecord } from "./ai-usage.types.ts"
import { ServiceUnavailableError } from "@/common/errors/app-error.ts"

export const aiUsageService = {
	async record(record: AIUsageRecord): Promise<void> {
		if (!env.AI_USAGE_TRACKING_ENABLED) return
		try {
			await aiUsageRepository.create(record)
		} catch (error) {
			logger.error(
				{
					err: error,
					workspaceId: record.workspaceId,
					provider: record.provider,
				},
				"Failed to record AI usage",
			)
			throw new ServiceUnavailableError("AI usage metering is unavailable")
		}
	},
}
