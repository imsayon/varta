export interface AIUsageRecord {
	workspaceId: string
	provider: string
	model: string
	inputTokens?: number | undefined
	outputTokens?: number | undefined
	latencyMs: number
	promptVersion?: string | undefined
	requestId?: string | undefined
	status: "success" | "failed"
	errorCategory?: string | undefined
}
