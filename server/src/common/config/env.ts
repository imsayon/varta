import { z } from "zod"
import { AI_DEFAULTS } from "@/infra/ai/ai.constants.ts"

const booleanEnv = z.preprocess(
	(value) =>
		typeof value === "string" ? value.toLowerCase() === "true" : value,
	z.boolean(),
)

const envSchema = z
	.object({
		PORT: z.coerce.number().default(5000),
		METRICS_PORT: z.coerce.number().default(5001),
		SERVICE_NAME: z.string().default("varta-api"),
		LOG_LEVEL: z
			.enum([
				"fatal",
				"error",
				"warn",
				"info",
				"debug",
				"trace",
				"silent",
			])
			.default("info"),
		LOG_DEBUG_ENABLED: booleanEnv.default(false),
		LOG_DEBUG_TTL_SECONDS: z.coerce
			.number()
			.int()
			.min(60)
			.max(3_600)
			.default(900),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		CORS_ORIGIN: z.string().default("http://localhost:3000"),
		DATABASE_URL: z.string(),
		REDIS_URL: z.string().default("redis://localhost:6379"),
		REDIS_QUEUE_PREFIX: z
			.string()
			.trim()
			.min(1)
			.max(64)
			.regex(
				/^[A-Za-z0-9._-]+$/,
				"REDIS_QUEUE_PREFIX may contain only letters, numbers, '.', '_' or '-'",
			)
			.default("varta"),
		STARTUP_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
		SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
		OTEL_ENABLED: booleanEnv.default(false),
		OTEL_EXPORTER_OTLP_ENDPOINT: z
			.string()
			.default("http://localhost:4318"),
		OTEL_EXPORT_TIMEOUT_MS: z.coerce
			.number()
			.int()
			.min(100)
			.max(10_000)
			.default(3_000),
		OTEL_SAMPLE_RATIO: z.coerce.number().min(0).max(1).default(0.1),

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
				: z
						.string()
						.default("local-websocket-secret-change-me-32-chars"),
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
				? z
						.string()
						.min(
							16,
							"RESEND_WEBHOOK_SECRET is required in production",
						)
				: z.string().default(""),
		EMAIL_FROM: z.string().default("Varta <onboarding@resend.dev>"),
		PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
		EMAIL_VERIFY_TOKEN_TTL_HOURS: z.coerce.number().default(24),

		AI_ENABLED: booleanEnv.default(false),
		AI_PLATFORM_PROVIDER: z
			.literal("gemini")
			.default(AI_DEFAULTS.platformProvider),
		AI_PLATFORM_MODEL: z.string().trim().default(""),
		AI_PLATFORM_API_KEY: z.string().default(""),
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
		AI_SEND_TIME_OPTIMIZATION_ENABLED: booleanEnv.default(false),
		AI_REQUESTS_PER_MINUTE: z.coerce
			.number()
			.int()
			.positive()
			.default(AI_DEFAULTS.requestsPerMinute),
		AI_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
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

		RAZORPAY_MODE: z.enum(["disabled", "test", "live"]).default("disabled"),
		RAZORPAY_KEY_ID: z.string().default(""),
		RAZORPAY_KEY_SECRET: z.string().default(""),
		RAZORPAY_WEBHOOK_SECRET: z.string().default(""),
		RAZORPAY_WEBHOOK_SECRET_PREVIOUS: z.string().default(""),
		RAZORPAY_REQUEST_TIMEOUT_MS: z.coerce
			.number()
			.int()
			.min(500)
			.max(15_000)
			.default(5_000),
		RAZORPAY_PLUS_PLAN_ID_INR: z.string().default(""),
		RAZORPAY_BUSINESS_PLAN_ID_INR: z.string().default(""),
	})
	.superRefine((values, ctx) => {
		for (const provider of ["GITHUB", "GOOGLE"] as const) {
			const fields = [
				`${provider}_CLIENT_ID`,
				`${provider}_CLIENT_SECRET`,
				`${provider}_CALLBACK_URL`,
			] as const
			const configured = fields.filter((field) => Boolean(values[field]))
			if (configured.length > 0 && configured.length !== fields.length) {
				for (const field of fields) {
					if (!values[field])
						ctx.addIssue({
							code: "custom",
							path: [field],
							message: `${field} is required when ${provider} OAuth is enabled`,
						})
				}
			}
			if (values[fields[2]]) {
				try {
					const callback = new URL(values[fields[2]])
					const expectedPath = `/api/v1/auth/oauth/${provider.toLowerCase()}/callback`
					if (
						callback.pathname !== expectedPath ||
						(values.NODE_ENV === "production" &&
							callback.protocol !== "https:")
					) {
						ctx.addIssue({
							code: "custom",
							path: [fields[2]],
							message: `${fields[2]} must use the exact ${expectedPath} path${values.NODE_ENV === "production" ? " over HTTPS" : ""}`,
						})
					}
				} catch {
					ctx.addIssue({
						code: "custom",
						path: [fields[2]],
						message: `${fields[2]} must be an absolute URL`,
					})
				}
			}
		}

		if (values.RAZORPAY_MODE === "disabled") return
		const required: Array<keyof typeof values> = [
			"RAZORPAY_KEY_ID",
			"RAZORPAY_KEY_SECRET",
			"RAZORPAY_WEBHOOK_SECRET",
			"RAZORPAY_PLUS_PLAN_ID_INR",
			"RAZORPAY_BUSINESS_PLAN_ID_INR",
		]
		for (const field of required) {
			if (!values[field]) {
				ctx.addIssue({
					code: "custom",
					path: [field],
					message: `${field} is required when Razorpay is enabled`,
				})
			}
		}
		const expectedPrefix =
			values.RAZORPAY_MODE === "test" ? "rzp_test_" : "rzp_live_"
		if (
			values.RAZORPAY_KEY_ID &&
			!values.RAZORPAY_KEY_ID.startsWith(expectedPrefix)
		) {
			ctx.addIssue({
				code: "custom",
				path: ["RAZORPAY_KEY_ID"],
				message: `RAZORPAY_KEY_ID must match ${values.RAZORPAY_MODE} mode`,
			})
		}
	})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
	console.error("❌ Invalid environment variables:")
	console.error(parsed.error.flatten().fieldErrors)
	process.exit(1)
}

export const env = parsed.data
export type Env = z.infer<typeof envSchema>
