import type { z } from "zod"
import type { AI_FEATURES } from "./ai.constants.ts"

export type AIFeature = (typeof AI_FEATURES)[keyof typeof AI_FEATURES]

export interface AIRequest<T = unknown> {
	workspaceId: string
	feature: AIFeature
	input: string
	systemPrompt?: string | undefined
	outputSchema: z.ZodType<T>
	promptVersion?: string
}

export interface AICredentials {
	provider: string
	model: string
	apiKey: string
}

export interface AIProviderRequest {
	model: string
	apiKey: string
	systemPrompt?: string | undefined
	input: string
	maxInputTokens: number
	maxOutputTokens: number
	temperature: number
	signal: AbortSignal
}

export interface AIProviderResponse {
	text: string
	inputTokens?: number | undefined
	outputTokens?: number | undefined
	requestId?: string | undefined
}

export interface AIResponse<T> {
	data: T
	provider: string
	model: string
	inputTokens?: number | undefined
	outputTokens?: number | undefined
	requestId?: string | undefined
	latencyMs: number
}
