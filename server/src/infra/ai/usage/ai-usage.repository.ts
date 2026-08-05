import { prisma } from "@/infra/database/prisma.ts"
import type { AIUsageRecord } from "./ai-usage.types.ts"

export const aiUsageRepository = {
	async create(record: AIUsageRecord) {
		return prisma.aiUsage.create({
			data: {
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
				...(record.requestId !== undefined
					? { requestId: record.requestId }
					: {}),
				status: record.status,
				...(record.errorCategory !== undefined
					? { errorCategory: record.errorCategory }
					: {}),
			},
		})
	},
}
