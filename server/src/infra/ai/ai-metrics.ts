import { logger } from "@/infra/observability/logger.ts"

type CompileStatus = "success" | "invalid_output" | "error" | "rate_limited"
type StoResult = "delayed" | "immediate" | "error"

const counters = new Map<string, number>()

function increment(name: string, labels: Record<string, string> = {}) {
	const key = `${name}:${JSON.stringify(labels)}`
	counters.set(key, (counters.get(key) ?? 0) + 1)
}

export const aiMetrics = {
	compileRequest(status: CompileStatus, workspaceId: string) {
		increment("varta_ai_compile_requests_total", {
			workspace: workspaceId,
			status,
		})
	},
	compileDuration(durationMs: number) {
		logger.info(
			{ metric: "varta_ai_compile_duration_ms", durationMs },
			"AI compile completed",
		)
	},
	compileTokens(input: number, output: number) {
		increment("varta_ai_tokens_total", { type: "input" })
		increment("varta_ai_tokens_total", { type: "output" })
		logger.info(
			{ metric: "varta_ai_tokens", input, output },
			"AI token usage recorded",
		)
	},
	stoPrediction(result: StoResult, workspaceId: string) {
		increment("varta_sto_predictions_total", {
			workspace: workspaceId,
			result,
		})
	},
	stoVectorCompute(
		durationMs: number,
		workspaceId: string,
		subscribers: number,
	) {
		logger.info(
			{
				metric: "varta_sto_vector_compute_duration_ms",
				durationMs,
				workspaceId,
				subscribers,
			},
			"STO vectors computed",
		)
	},
	snapshot() {
		return Object.fromEntries(counters)
	},
}
