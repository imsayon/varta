import { z } from "zod"
import { AIProviderError } from "../ai.errors.ts"
import type { AIProviderRequest, AIProviderResponse } from "../ai.types.ts"

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta"

const responseSchema = z.object({
	candidates: z
		.array(
			z.object({
				content: z.object({
					parts: z.array(z.object({ text: z.string() })),
				}),
			}),
		)
		.min(1),
	usageMetadata: z
		.object({
			promptTokenCount: z.number().optional(),
			candidatesTokenCount: z.number().optional(),
		})
		.optional(),
})

export const geminiProvider = {
	async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
		const endpoint = `${ENDPOINT}/models/${encodeURIComponent(request.model)}:generateContent`
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-goog-api-key": request.apiKey,
			},
			signal: request.signal,
			body: JSON.stringify({
				...(request.systemPrompt
					? {
							systemInstruction: {
								parts: [{ text: request.systemPrompt }],
							},
						}
					: {}),
				contents: [{ role: "user", parts: [{ text: request.input }] }],
				generationConfig: {
					maxOutputTokens: request.maxOutputTokens,
					responseMimeType: "application/json",
					thinkingConfig: { thinkingLevel: "minimal" },
				},
			}),
		})
		if (!response.ok)
			throw new AIProviderError(
				`Gemini request failed with status ${response.status}`,
				"provider_http_error",
				response.status,
			)
		const parsed = responseSchema.safeParse(await response.json())
		if (!parsed.success)
			throw new AIProviderError(
				"Gemini returned an invalid response",
				"provider_response_invalid",
			)
		return {
			text:
				parsed.data.candidates[0]?.content.parts
					.map((part) => part.text)
					.join("") ?? "",
			inputTokens: parsed.data.usageMetadata?.promptTokenCount,
			outputTokens: parsed.data.usageMetadata?.candidatesTokenCount,
		}
	},
}
