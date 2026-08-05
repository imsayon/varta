import { randomUUID } from "node:crypto"
import { env } from "@/common/config/env.ts"
import { logger } from "@/infra/observability/logger.ts"
import { aiCredentials } from "./ai.credentials.ts"
import { aiPolicy } from "./ai.policy.ts"
import { aiRouter } from "./ai.router.ts"
import { initializeAIProviders } from "./ai.providers.ts"
import { promptRepository } from "./prompts/prompt.repository.ts"
import { aiUsageService } from "./usage/ai-usage.service.ts"
import { AIProviderError } from "./ai.errors.ts"
import { BadRequestError } from "@/common/errors/app-error.ts"
import type { AIProviderResponse, AIRequest, AIResponse } from "./ai.types.ts"
import { AI_DEFAULTS, AI_RETRYABLE_STATUS_CODES } from "./ai.constants.ts"

function parseJson<T>(text: string): T {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]
	return JSON.parse(fenced ?? text) as T
}

function isRetryable(error: unknown): boolean {
	if (error instanceof AIProviderError)
		return (
			AI_RETRYABLE_STATUS_CODES.has(error.statusCode ?? 0) ||
			(error.statusCode ?? 0) >= 500
		)
	return (
		error instanceof TypeError ||
		(error instanceof Error && error.name === "AbortError")
	)
}

export const aiGateway = {
	async generate<T>(request: AIRequest<T>): Promise<AIResponse<T>> {
		await aiPolicy.authorize(request.workspaceId, request.feature)
		if (
			request.input.length >
			env.AI_MAX_INPUT_TOKENS * AI_DEFAULTS.maxInputCharactersPerToken
		) {
			throw new BadRequestError("AI input exceeds the configured limit")
		}
		initializeAIProviders()
		const credentials = await aiCredentials.resolve(request.workspaceId)
		const provider = aiRouter.resolve(credentials)
		const prompt =
			request.systemPrompt ??
			(request.promptVersion
				? (await promptRepository.find(request.promptVersion)).content
				: undefined)
		const requestId = randomUUID()
		const startedAt = Date.now()
		const controller = new AbortController()
		const timeout = setTimeout(
			() => controller.abort(),
			env.AI_REQUEST_TIMEOUT_MS,
		)
		try {
			let result: AIProviderResponse
			for (let attempt = 0; ; attempt += 1) {
				try {
					result = await provider.generate({
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
					if (!isRetryable(error) || attempt >= env.AI_MAX_RETRIES)
						throw error
					const delayMs = Math.min(
						2 ** attempt * AI_DEFAULTS.retryBaseDelayMs,
						AI_DEFAULTS.maxRetryDelayMs,
					)
					await new Promise((resolve) => setTimeout(resolve, delayMs))
				}
			}
			let parsed: T
			try {
				parsed = parseJson<T>(result.text)
			} catch {
				throw new BadRequestError("AI provider returned invalid JSON")
			}
			const validated = request.outputSchema.safeParse(parsed)
			if (!validated.success)
				throw new BadRequestError(
					"AI provider response failed schema validation",
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
				errorCategory: error instanceof Error ? error.name : "unknown",
			})
			logger.warn(
				{
					requestId,
					workspaceId: request.workspaceId,
					provider: credentials.provider,
					model: credentials.model,
					latencyMs,
					err: error instanceof Error ? error.message : "unknown",
				},
				"AI request failed",
			)
			throw error
		} finally {
			clearTimeout(timeout)
		}
	},
}
