import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { env } from "@/common/config/env.ts"
import {
	BadRequestError,
	TooManyRequestsError,
} from "@/common/errors/app-error.ts"
import { logger } from "@/infra/observability/logger.ts"
import {
	aiCircuitOpen,
	aiGatewayDuration,
	aiGatewayRequests,
	aiTokens,
} from "@/infra/observability/metrics.ts"
import { withTrace } from "@/infra/observability/tracing.ts"
import { AIProviderError } from "./ai.errors.ts"
import { aiCredentials } from "./ai.credentials.ts"
import { aiPolicy } from "./ai.policy.ts"
import { getAICircuitBreaker } from "./ai.circuit-breaker.ts"
import { AI_DEFAULTS } from "./ai.constants.ts"
import { geminiProvider } from "./providers/gemini.provider.ts"
import { aiUsageService } from "./usage/ai-usage.service.ts"
import { billingService } from "@/modules/billing/billing.service.ts"
import type { AIProviderResponse, AIRequest, AIResponse } from "./ai.types.ts"

const activeByWorkspace = new Map<string, number>()

function acquireWorkspaceConcurrency(workspaceId: string): () => void {
	const active = activeByWorkspace.get(workspaceId) ?? 0
	if (active >= env.AI_MAX_CONCURRENCY)
		throw new TooManyRequestsError("Workspace AI concurrency limit reached")
	activeByWorkspace.set(workspaceId, active + 1)
	return () => {
		const remaining = (activeByWorkspace.get(workspaceId) ?? 1) - 1
		if (remaining <= 0) activeByWorkspace.delete(workspaceId)
		else activeByWorkspace.set(workspaceId, remaining)
	}
}

function parseJson<T>(value: string): T {
	const fenced = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]
	return JSON.parse(fenced ?? value) as T
}

function isRetryable(error: unknown, signal: AbortSignal): boolean {
	if (signal.aborted) return false
	if (error instanceof AIProviderError) {
		return error.statusCode === 429 || (error.statusCode ?? 0) >= 500
	}
	return error instanceof TypeError
}

async function sleepWithSignal(
	delayMs: number,
	signal: AbortSignal,
): Promise<void> {
	if (signal.aborted)
		throw signal.reason ?? new DOMException("Aborted", "AbortError")
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, delayMs)
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer)
				reject(
					signal.reason ?? new DOMException("Aborted", "AbortError"),
				)
			},
			{ once: true },
		)
	})
}

export const aiGateway = {
	async generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
		const requestId = randomUUID()
		const release = acquireWorkspaceConcurrency(request.workspaceId)
		const startedAt = Date.now()
		const controller = new AbortController()
		const timeout = setTimeout(
			() =>
				controller.abort(
					new DOMException("AI deadline exceeded", "TimeoutError"),
				),
			env.AI_REQUEST_TIMEOUT_MS,
		)
		try {
			if (
				request.input.length >
				env.AI_MAX_INPUT_TOKENS * AI_DEFAULTS.maxInputCharactersPerToken
			) {
				throw new BadRequestError(
					"AI input exceeds the configured limit",
				)
			}
			await aiPolicy.authorize(request.workspaceId, request.feature)
			const credentials = await aiCredentials.resolve(request.workspaceId)
			const breaker = getAICircuitBreaker(
				credentials.provider,
				credentials.model,
			)
			const prompt =
				request.systemPrompt ??
				(request.promptVersion
					? await readFile(
							path.resolve(
								process.cwd(),
								env.AI_PROMPT_DIRECTORY,
								`${request.promptVersion}.system.md`,
							),
							"utf8",
						)
					: undefined)
			const promptVersion = request.promptVersion ?? "none"
			const labels = {
				provider: credentials.provider,
				model: credentials.model,
				feature: request.feature,
				prompt_version: promptVersion,
			}

			return await withTrace(
				"ai.gateway.generate",
				{
					"gen_ai.system": credentials.provider,
					"gen_ai.request.model": credentials.model,
					"varta.ai.feature": request.feature,
					"varta.ai.prompt_version": promptVersion,
				},
				async () => {
					try {
						breaker.beforeRequest()
						aiCircuitOpen.set(
							{
								provider: credentials.provider,
								model: credentials.model,
							},
							0,
						)
						await billingService.reserveAiQuota(
							request.workspaceId,
							requestId,
						)
						let result: AIProviderResponse
						for (let attempt = 0; ; attempt += 1) {
							try {
								result = await geminiProvider.generate({
									...credentials,
									input: request.input,
									...(prompt ? { systemPrompt: prompt } : {}),
									maxInputTokens: env.AI_MAX_INPUT_TOKENS,
									maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
									temperature: env.AI_TEMPERATURE,
									signal: controller.signal,
								})
								break
							} catch (error) {
								if (
									!isRetryable(error, controller.signal) ||
									attempt >= env.AI_MAX_RETRIES
								) {
									breaker.onFailure()
									aiCircuitOpen.set(
										{
											provider: credentials.provider,
											model: credentials.model,
										},
										breaker.getState() === "OPEN" ? 1 : 0,
									)
									throw error
								}
								const baseDelay = Math.min(
									2 ** attempt * AI_DEFAULTS.retryBaseDelayMs,
									AI_DEFAULTS.maxRetryDelayMs,
								)
								await sleepWithSignal(
									Math.floor(
										baseDelay * (0.5 + Math.random()),
									),
									controller.signal,
								)
							}
						}
						if (result.inputTokens)
							aiTokens.inc(
								{ direction: "input" },
								result.inputTokens,
							)
						if (result.outputTokens)
							aiTokens.inc(
								{ direction: "output" },
								result.outputTokens,
							)
						let parsed: T
						try {
							parsed = parseJson<T>(result.text)
						} catch {
							breaker.onFailure()
							aiCircuitOpen.set(
								{
									provider: credentials.provider,
									model: credentials.model,
								},
								breaker.getState() === "OPEN" ? 1 : 0,
							)
							throw new BadRequestError(
								"AI provider returned invalid JSON",
							)
						}
						const validated = request.outputSchema.safeParse(parsed)
						if (!validated.success) {
							breaker.onFailure()
							aiCircuitOpen.set(
								{
									provider: credentials.provider,
									model: credentials.model,
								},
								breaker.getState() === "OPEN" ? 1 : 0,
							)
							throw new BadRequestError(
								"AI provider response failed schema validation",
							)
						}
						breaker.onSuccess()
						aiCircuitOpen.set(
							{
								provider: credentials.provider,
								model: credentials.model,
							},
							0,
						)
						const latencyMs = Date.now() - startedAt
						await aiUsageService.record({
							workspaceId: request.workspaceId,
							provider: credentials.provider,
							model: credentials.model,
							inputTokens: result.inputTokens,
							outputTokens: result.outputTokens,
							latencyMs,
							...(request.promptVersion
								? { promptVersion: request.promptVersion }
								: {}),
							requestId,
							status: "success",
						})
						aiGatewayRequests.inc({ ...labels, outcome: "success" })
						aiGatewayDuration.observe(labels, latencyMs / 1_000)
						return {
							data: validated.data,
							provider: credentials.provider,
							model: credentials.model,
							inputTokens: result.inputTokens,
							outputTokens: result.outputTokens,
							requestId,
							latencyMs,
						}
					} catch (error) {
						const latencyMs = Date.now() - startedAt
						await aiUsageService.record({
							workspaceId: request.workspaceId,
							provider: credentials.provider,
							model: credentials.model,
							latencyMs,
							...(request.promptVersion
								? { promptVersion: request.promptVersion }
								: {}),
							requestId,
							status: "failed",
							errorCategory:
								error instanceof Error ? error.name : "unknown",
						})
						aiGatewayRequests.inc({ ...labels, outcome: "failed" })
						aiGatewayDuration.observe(labels, latencyMs / 1_000)
						logger.warn(
							{
								requestId,
								workspaceId: request.workspaceId,
								provider: credentials.provider,
								model: credentials.model,
								latencyMs,
								err:
									error instanceof Error
										? error.message
										: "unknown",
							},
							"AI request failed",
						)
						throw error
					}
				},
			)
		} finally {
			clearTimeout(timeout)
			release()
		}
	},
}
