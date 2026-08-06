import { z } from "zod"
import { AI_DEFAULTS } from "@/infra/ai/ai.constants.ts"

const booleanEnv = z.preprocess(
	(value) =>
		typeof value === "string" ? value.toLowerCase() === "true" : value,
	z.boolean(),
)

const envSchema = z.object({
	PORT: z.coerce.number().default(5000),
	METRICS_PORT: z.coerce.number().default(5001),
	SERVICE_NAME: z.string().default("varta-api"),
	LOG_LEVEL: z.string().default("info"),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	CORS_ORIGIN: z.string().default("http://localhost:3000"),
	DATABASE_URL: z.string(),
	REDIS_URL: z.string().default("redis://localhost:6379"),
	REDIS_QUEUE_PREFIX: z.string().default("varta"),
	STARTUP_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
	SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
	OTEL_ENABLED: booleanEnv.default(false),
	OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:4318"),

	JWT_ACCESS_SECRET:
		process.env.NODE_ENV === "production"
			? z
					.string()
					.min(
						32,
						"JWT_ACCESS_SECRET must be at least 32 characters in production",
					)
			: z.string().default("local-access-secret-change-me-32-chars"),
	JWT_REFRESH_SECRET:
		process.env.NODE_ENV === "production"
			? z
					.string()
					.min(
						32,
						"JWT_REFRESH_SECRET must be at least 32 characters in production",
					)
			: z.string().default("local-refresh-secret-change-me-32-chars"),
	JWT_WS_SECRET:
		process.env.NODE_ENV === "production"
			? z
					.string()
					.min(
						32,
						"JWT_WS_SECRET must be at least 32 characters in production",
					)
			: z.string().default("local-websocket-secret-change-me-32-chars"),
	JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
	JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
	METRICS_AUTH_TOKEN:
		process.env.NODE_ENV === "production"
			? z
					.string()
					.min(
						16,
						"METRICS_AUTH_TOKEN must be at least 16 characters in production",
					)
			: z.string().default("local-metrics-token-change-me-32-chars"),

	GITHUB_CLIENT_ID: z.string().default(""),
	GITHUB_CLIENT_SECRET: z.string().default(""),
	GITHUB_CALLBACK_URL: z.string().default(""),
	GOOGLE_CLIENT_ID: z.string().default(""),
	GOOGLE_CLIENT_SECRET: z.string().default(""),
	GOOGLE_CALLBACK_URL: z.string().default(""),

	CLIENT_URL: z.string().default("http://localhost:3000"),
	RESEND_API_KEY: z.string().default(""),
	RESEND_WEBHOOK_SECRET:
		process.env.NODE_ENV === "production"
			? z.string().min(16, "RESEND_WEBHOOK_SECRET is required in production")
			: z.string().default(""),
	EMAIL_FROM: z.string().default("Varta <onboarding@resend.dev>"),
	PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
	EMAIL_VERIFY_TOKEN_TTL_HOURS: z.coerce.number().default(24),

	AI_ENABLED: booleanEnv.default(false),
	AI_PLATFORM_PROVIDER: z
		.string()
		.trim()
		.default(AI_DEFAULTS.platformProvider),
	AI_PLATFORM_MODEL: z.string().trim().default(""),
	AI_PLATFORM_API_KEY: z.string().default(""),
	AI_PLATFORM_BASE_URL: z.string().trim().default(""),
	AI_REQUEST_TIMEOUT_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(AI_DEFAULTS.requestTimeoutMs),
	AI_MAX_RETRIES: z.coerce
		.number()
		.int()
		.min(0)
		.max(5)
		.default(AI_DEFAULTS.maxRetries),
	AI_MAX_INPUT_TOKENS: z.coerce
		.number()
		.int()
		.positive()
		.default(AI_DEFAULTS.maxInputTokens),
	AI_MAX_OUTPUT_TOKENS: z.coerce
		.number()
		.int()
		.positive()
		.default(AI_DEFAULTS.maxOutputTokens),
	AI_TEMPERATURE: z.coerce
		.number()
		.min(0)
		.max(2)
		.default(AI_DEFAULTS.temperature),
	AI_LOG_PROMPT_CONTENT: booleanEnv.default(false),
	AI_CONFIGURATION_PLANNER_ENABLED: booleanEnv.default(false),
	AI_SEND_TIME_OPTIMIZATION_ENABLED: booleanEnv.default(false),
	AI_REQUESTS_PER_MINUTE: z.coerce
		.number()
		.int()
		.positive()
		.default(AI_DEFAULTS.requestsPerMinute),
	AI_RATE_LIMIT_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(AI_DEFAULTS.rateLimitWindowSeconds),
	AI_USAGE_TRACKING_ENABLED: booleanEnv.default(true),
	AI_PROMPT_DIRECTORY: z.string().default(AI_DEFAULTS.promptDirectory),
	ENCRYPTION_KEY:
		process.env.NODE_ENV === "production"
			? z
					.string()
					.min(
						32,
						"ENCRYPTION_KEY must be at least 32 characters in production",
					)
			: z.string().default("0123456789abcdef0123456789abcdef"),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
	console.error("❌ Invalid environment variables:")
	console.error(parsed.error.flatten().fieldErrors)
	process.exit(1)
}

export const env = parsed.data
export type Env = z.infer<typeof envSchema>
