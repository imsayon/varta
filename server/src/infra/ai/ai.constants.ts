export const AI_PROVIDERS = {
	GEMINI: "gemini",
	OPENAI: "openai",
	ANTHROPIC: "anthropic",
	KIMI: "kimi",
	OPENAI_COMPATIBLE: "openai-compatible",
} as const

export const AI_FEATURES = {
	ROUTING_COMPILER: "routing_compiler",
	SEND_TIME_OPTIMIZATION: "send_time_optimization",
} as const

export const AI_PROMPT_VERSIONS = {
	ROUTING_COMPILER_V1: "routing_compiler_v1",
} as const

// Phase E launch policy: the gateway stays provider-neutral internally, but only
// one current, stable, free-tier Gemini model is production-enabled.
export const AI_PROVIDER_MODELS: Record<string, ReadonlyArray<string>> = {
	[AI_PROVIDERS.GEMINI]: ["gemini-3.6-flash"],
}

// E3: Prompt and output schema version registry for rollback.
// Each entry names a prompt file, its input/output schema version, and supported models.
export const AI_PROMPT_SCHEMA_REGISTRY = {
	[AI_PROMPT_VERSIONS.ROUTING_COMPILER_V1]: {
		promptFile: "routing_compiler_v1.system.md",
		inputSchemaVersion: "1",
		outputSchemaVersion: "1",
		supportedModels: ["gemini-3.6-flash"],
	},
} as const

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

export const AI_PROVIDER_ENDPOINTS = {
	OPENAI: "https://api.openai.com/v1",
	ANTHROPIC: "https://api.anthropic.com/v1",
	KIMI: "https://api.moonshot.ai/v1",
	GEMINI: "https://generativelanguage.googleapis.com/v1beta",
} as const

export const AI_REDIS_KEY_PREFIX = "varta_ai_requests"
export const AI_ANTHROPIC_API_VERSION = "2023-06-01"
export const AI_RETRYABLE_STATUS_CODES = new Set([429])
