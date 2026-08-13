import assert from "node:assert/strict"
import test from "node:test"
import { GeminiProvider } from "./gemini.provider.ts"

const enabled = process.env.RUN_GEMINI_CONTRACT_TESTS === "true"

test("Gemini production model satisfies the bounded JSON provider contract", { skip: !enabled }, async () => {
	const apiKey = process.env.AI_PLATFORM_API_KEY
	assert.ok(apiKey, "AI_PLATFORM_API_KEY is required for the live contract test")
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), 15_000)
	try {
		const result = await new GeminiProvider().generate({
			model: "gemini-3.6-flash",
			apiKey,
			systemPrompt: "Return only valid JSON matching the requested shape.",
			input: "Return an object with ok set to true.",
			maxInputTokens: 256,
			maxOutputTokens: 512,
			temperature: 0,
			signal: controller.signal,
		})
		assert.deepEqual(JSON.parse(result.text), { ok: true })
		assert.ok((result.outputTokens ?? 0) > 0)
	} finally {
		clearTimeout(timeout)
	}
})
