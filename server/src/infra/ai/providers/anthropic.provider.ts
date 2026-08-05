import { z } from "zod"
import { AIProviderError } from "../ai.errors.ts"
import type { AIProviderRequest, AIProviderResponse } from "../ai.types.ts"
import type { AIProvider } from "./ai-provider.interface.ts"
import {
	AI_PROVIDER_ENDPOINTS,
	AI_ANTHROPIC_API_VERSION,
	AI_PROVIDERS,
} from "../ai.constants.ts"

const responseSchema = z.object({
	id: z.string().optional(),
	content: z
		.array(z.object({ type: z.literal("text"), text: z.string() }))
		.min(1),
	usage: z
		.object({
			input_tokens: z.number().optional(),
			output_tokens: z.number().optional(),
		})
		.optional(),
})

export class AnthropicProvider implements AIProvider {
	readonly name = AI_PROVIDERS.ANTHROPIC

	async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
		const endpoint = `${(request.baseUrl || AI_PROVIDER_ENDPOINTS.ANTHROPIC).replace(/\/$/, "")}/messages`
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-api-key": request.apiKey,
				"anthropic-version": AI_ANTHROPIC_API_VERSION,
			},
			signal: request.signal,
			body: JSON.stringify({
				model: request.model,
				max_tokens: request.maxOutputTokens,
				temperature: request.temperature,
				...(request.systemPrompt
					? { system: request.systemPrompt }
					: {}),
				messages: [{ role: "user", content: request.input }],
			}),
		})
		if (!response.ok)
			throw new AIProviderError(
				`Anthropic request failed with status ${response.status}`,
				"provider_http_error",
				response.status,
			)
		const parsed = responseSchema.safeParse(await response.json())
		if (!parsed.success)
			throw new AIProviderError(
				"Anthropic returned an invalid response",
				"provider_response_invalid",
			)
		return {
			text: parsed.data.content.map((part) => part.text).join(""),
			inputTokens: parsed.data.usage?.input_tokens,
			outputTokens: parsed.data.usage?.output_tokens,
			requestId: parsed.data.id,
		}
	}
}
