export const AI_PROVIDERS = {
	GEMINI: "gemini",
	OPENAI: "openai",
	ANTHROPIC: "anthropic",
	KIMI: "kimi",
	OPENAI_COMPATIBLE: "openai-compatible",
} as const

export const AI_FEATURES = {
	ROUTING_COMPILER: "routing_compiler",
	CONFIGURATION_PLANNER: "configuration_planner",
	SEND_TIME_OPTIMIZATION: "send_time_optimization",
} as const

export const AI_PROMPT_VERSIONS = {
	ROUTING_COMPILER_V1: "routing_compiler_v1",
} as const

// E2: Allowlisted providers and their accepted models.
// The openai-compatible provider accepts any model string (BYOK endpoint responsibility).
// Add new models here after verifying sandbox compatibility.
export const AI_PROVIDER_MODELS: Record<string, ReadonlyArray<string>> = {
	[AI_PROVIDERS.GEMINI]: [
		"gemini-2.0-flash",
		"gemini-2.0-flash-lite",
		"gemini-1.5-flash",
		"gemini-1.5-pro",
	],
	[AI_PROVIDERS.OPENAI]: [
		"gpt-4o",
		"gpt-4o-mini",
		"gpt-4-turbo",
	],
	[AI_PROVIDERS.ANTHROPIC]: [
		"claude-3-5-sonnet-20241022",
		"claude-3-5-haiku-20241022",
		"claude-3-opus-20240229",
	],
	[AI_PROVIDERS.KIMI]: [
		"moonshot-v1-8k",
		"moonshot-v1-32k",
		"moonshot-v1-128k",
	],
	// openai-compatible: model string is caller-supplied; no allowlist enforced here.
}

// E3: Prompt and output schema version registry for rollback.
// Each entry names a prompt file, its input/output schema version, and supported models.
export const AI_PROMPT_SCHEMA_REGISTRY = {
	[AI_PROMPT_VERSIONS.ROUTING_COMPILER_V1]: {
		promptFile: "routing_compiler_v1.system.md",
		inputSchemaVersion: "1",
		outputSchemaVersion: "1",
		supportedModels: [
			"gemini-2.0-flash",
			"gemini-2.0-flash-lite",
			"gemini-1.5-flash",
			"gpt-4o",
			"gpt-4o-mini",
		],
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
