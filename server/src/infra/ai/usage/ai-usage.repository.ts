import { prisma } from "@/infra/database/prisma.ts"
import type { AIUsageRecord } from "./ai-usage.types.ts"

export const aiUsageRepository = {
	async create(record: AIUsageRecord) {
		if (!record.requestId) throw new Error("AI usage requires a request ID")
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
		return prisma.aiUsage.upsert({
			where: {
				workspaceId_requestId: { workspaceId: record.workspaceId, requestId: record.requestId },
			},
			create: data,
			update: data,
		})
	},
}
