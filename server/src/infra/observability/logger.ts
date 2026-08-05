import pino from "pino"
import { env } from "@/common/config/env.ts"

export const logger = pino({
	name: "varta",
	level: env.LOG_LEVEL,
	redact: {
		paths: [
			"req.headers.authorization",
			"req.headers.cookie",
			"req.headers['x-api-key']",
			"*.apiKey",
			"*.accessToken",
			"*.refreshToken",
			"*.signingSecret",
			"*.password",
		],
		censor: "[REDACTED]",
	},
	...(env.NODE_ENV === "development" && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "SYS:HH:MM:ss.l",
				ignore: "pid,hostname",
			},
		},
	}),
})
