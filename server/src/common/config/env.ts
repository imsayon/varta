import { z } from "zod"

const envSchema = z.object({
	PORT: z.coerce.number().default(5000),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	CORS_ORIGIN: z.string().default("http://localhost:3000"),
	DATABASE_URL: z.string(),
	REDIS_URL: z.string().default("redis://localhost:6379"),

	JWT_ACCESS_SECRET: z.string(),
	JWT_REFRESH_SECRET: z.string(),
	JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
	JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

	GITHUB_CLIENT_ID: z.string().default(""),
	GITHUB_CLIENT_SECRET: z.string().default(""),
	GITHUB_CALLBACK_URL: z.string().default(""),
	GOOGLE_CLIENT_ID: z.string().default(""),
	GOOGLE_CLIENT_SECRET: z.string().default(""),
	GOOGLE_CALLBACK_URL: z.string().default(""),

	CLIENT_URL: z.string().default("http://localhost:3000"),
	RESEND_API_KEY: z.string().default(""),
	EMAIL_FROM: z.string().default("Varta <onboarding@resend.dev>"),
	PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
	EMAIL_VERIFY_TOKEN_TTL_HOURS: z.coerce.number().default(24),

	ANTHROPIC_API_KEY: z.string().default(""),
	ENCRYPTION_KEY: z.string().default(""),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
	console.error("❌ Invalid environment variables:")
	console.error(parsed.error.flatten().fieldErrors)
	process.exit(1)
}

export const env = parsed.data
export type Env = z.infer<typeof envSchema>
