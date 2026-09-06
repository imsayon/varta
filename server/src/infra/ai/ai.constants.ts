export const AI_PROVIDERS = {
	GEMINI: "gemini",
} as const

export const AI_FEATURES = {
	ROUTING_COMPILER: "routing_compiler",
	SEND_TIME_OPTIMIZATION: "send_time_optimization",
} as const

export const AI_PROMPT_VERSIONS = {
	ROUTING_COMPILER_V1: "routing_compiler_v1",
} as const

export const AI_PROVIDER_MODELS: Record<string, ReadonlyArray<string>> = {
	[AI_PROVIDERS.GEMINI]: ["gemini-3.6-flash"],
}

export const AI_DEFAULTS = {
	platformProvider: AI_PROVIDERS.GEMINI,
	requestTimeoutMs: 30_000,
	maxRetries: 2,
	maxInputTokens: 12_000,
	maxOutputTokens: 2_048,
	temperature: 0,
	requestsPerMinute: 20,
	rateLimitWindowSeconds: 60,
	promptDirectory: "src/infra/ai/prompts/assets",
	maxRetryDelayMs: 4_000,
	retryBaseDelayMs: 250,
	maxInputCharactersPerToken: 4,
} as const

export const AI_REDIS_KEY_PREFIX = "varta_ai_requests"
