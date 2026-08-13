import {
	aiDuration,
	aiRequests,
	aiTokens,
} from "@/infra/observability/metrics.ts"

type CompileStatus = "success" | "invalid_output" | "error" | "rate_limited"
type StoResult = "delayed" | "immediate" | "error"

export const aiMetrics = {
	compileRequest(status: CompileStatus, _workspaceId: string) {
		aiRequests.inc({ feature: "routing_compile", outcome: status })
	},
	compileDuration(durationMs: number) {
		aiDuration.observe({ feature: "routing_compile" }, durationMs / 1_000)
	},
	compileTokens(input: number, output: number) {
		aiTokens.inc({ direction: "input" }, input)
		aiTokens.inc({ direction: "output" }, output)
	},
	stoPrediction(result: StoResult, _workspaceId: string) {
		aiRequests.inc({ feature: "send_time_optimization", outcome: result })
	},
	stoVectorCompute(
		durationMs: number,
		_workspaceId: string,
		_subscribers: number,
	) {
		aiDuration.observe({ feature: "sto_vector_compute" }, durationMs / 1_000)
	},
}
