import assert from "node:assert/strict"
import test from "node:test"
import { aiMetrics } from "@/infra/ai/ai-metrics.ts"
import {
	boundedProviderLabel,
	metricsRegistry,
	normalizeHttpRoute,
	observeHttp,
} from "./metrics.ts"

test("HTTP metric labels normalize identifiers and status classes", async () => {
	const workspaceId = "6d44f7a8-f17e-4c17-9a94-c6860977c365"
	observeHttp("get", `/api/v1/workspaces/${workspaceId}/notifications/notif_123`, 201, 0.01)
	const output = await metricsRegistry.metrics()
	assert.match(output, /route="\/api\/v1\/workspaces\/:id\/notifications\/:id"/)
	assert.match(output, /status_class="2xx"/)
	assert.doesNotMatch(output, new RegExp(workspaceId))
})

test("AI metrics are Prometheus-backed without workspace labels", async () => {
	const workspaceId = "workspace-secret-cardinality-value"
	aiMetrics.compileRequest("success", workspaceId)
	aiMetrics.compileDuration(125)
	aiMetrics.compileTokens(20, 10)
	const output = await metricsRegistry.metrics()
	assert.match(output, /varta_ai_requests_total\{feature="routing_compile",outcome="success"\}/)
	assert.match(output, /varta_ai_request_duration_seconds/)
	assert.match(output, /varta_ai_tokens_total\{direction="input"\} 20/)
	assert.doesNotMatch(output, new RegExp(workspaceId))
})

test("provider labels collapse unknown configuration values", () => {
	assert.equal(boundedProviderLabel("Resend"), "resend")
	assert.equal(boundedProviderLabel("workspace-defined-provider"), "other")
	assert.equal(normalizeHttpRoute("/api/v1/items/123?token=secret"), "/api/v1/items/:id")
})
