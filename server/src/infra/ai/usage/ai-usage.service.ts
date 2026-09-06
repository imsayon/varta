import { logger } from "@/infra/observability/logger.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { env } from "@/common/config/env.ts"
import { ServiceUnavailableError } from "@/common/errors/app-error.ts"

type AIUsageRecord = {
	workspaceId: string
	provider: string
	model: string
	inputTokens?: number | undefined
	outputTokens?: number | undefined
	latencyMs: number
	promptVersion?: string | undefined
	requestId: string
	status: "success" | "failed"
	errorCategory?: string | undefined
}

export const aiUsageService = {
	async record(record: AIUsageRecord): Promise<void> {
		if (!env.AI_USAGE_TRACKING_ENABLED) return
		try {
			const data = {
				workspaceId: record.workspaceId,
				provider: record.provider,
				model: record.model,
				...(record.inputTokens !== undefined
					? { inputTokens: record.inputTokens }
					: {}),
				...(record.outputTokens !== undefined
					? { outputTokens: record.outputTokens }
					: {}),
				latencyMs: record.latencyMs,
				...(record.promptVersion !== undefined
					? { promptVersion: record.promptVersion }
					: {}),
				requestId: record.requestId,
				status: record.status,
				...(record.errorCategory !== undefined
					? { errorCategory: record.errorCategory }
					: {}),
			}
			await prisma.aiUsage.upsert({
				where: {
					workspaceId_requestId: {
						workspaceId: record.workspaceId,
						requestId: record.requestId,
					},
				},
				create: data,
				update: data,
			})
		} catch (error) {
			logger.error(
				{
					err: error,
					workspaceId: record.workspaceId,
					provider: record.provider,
				},
				"Failed to record AI usage",
			)
			throw new ServiceUnavailableError(
				"AI usage metering is unavailable",
			)
		}
	},
}
