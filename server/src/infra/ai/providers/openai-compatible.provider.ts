import { z } from "zod"
import { AIProviderError } from "../ai.errors.ts"
import type { AIProviderRequest, AIProviderResponse } from "../ai.types.ts"
import type { AIProvider } from "./ai-provider.interface.ts"

const responseSchema = z.object({
	id: z.string().optional(),
	choices: z
		.array(
			z.object({ message: z.object({ content: z.string().nullable() }) }),
		)
		.min(1),
	usage: z
		.object({
			prompt_tokens: z.number().optional(),
			completion_tokens: z.number().optional(),
		})
		.optional(),
})

export class OpenAICompatibleProvider implements AIProvider {
	constructor(
		public readonly name: string,
		private readonly defaultBaseUrl: string,
	) {}

	async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
		const endpoint = `${(request.baseUrl || this.defaultBaseUrl).replace(/\/$/, "")}/chat/completions`
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${request.apiKey}`,
			},
			signal: request.signal,
			body: JSON.stringify({
				model: request.model,
				messages: [
					...(request.systemPrompt
						? [{ role: "system", content: request.systemPrompt }]
						: []),
					{ role: "user", content: request.input },
				],
				temperature: request.temperature,
				max_tokens: request.maxOutputTokens,
				response_format: { type: "json_object" },
			}),
		})
		if (!response.ok)
			throw new AIProviderError(
				`${this.name} request failed with status ${response.status}`,
				"provider_http_error",
				response.status,
			)
		const parsed = responseSchema.safeParse(await response.json())
		if (!parsed.success)
			throw new AIProviderError(
				`${this.name} returned an invalid response`,
				"provider_response_invalid",
			)
		return {
			text: parsed.data.choices[0]?.message.content ?? "",
			inputTokens: parsed.data.usage?.prompt_tokens,
			outputTokens: parsed.data.usage?.completion_tokens,
			requestId: parsed.data.id,
		}
	}
}
