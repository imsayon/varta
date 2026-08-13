import pino from "pino"
import { env } from "@/common/config/env.ts"
import {
	currentLogContext,
	type LogIdentifiers,
} from "./log-context.ts"

export const LOG_COMPONENTS = [
	"api",
	"worker",
	"provider",
	"ai",
	"billing",
	"security",
] as const

export type LogComponent = (typeof LOG_COMPONENTS)[number]
export type StructuredLogEvent = LogIdentifiers & {
	schemaVersion: 1
	component: LogComponent
	event: string
	outcome?: string
}

export function logEvent(
	component: LogComponent,
	event: string,
	identifiers: LogIdentifiers = {},
	outcome?: string,
): StructuredLogEvent {
	return {
		schemaVersion: 1,
		component,
		event,
		...identifiers,
		...(outcome ? { outcome } : {}),
	}
}

export const LOGGER_REDACTION_PATHS = [
	"req.headers.authorization",
	"req.headers.cookie",
	"req.headers['x-api-key']",
	"req.headers['x-razorpay-signature']",
	"req.headers['svix-signature']",
	"req.headers['x-webhook-signature']",
	"req.url",
	"req.body",
	"body",
	"payload",
	"content",
	"input",
	"output",
	"res.headers['set-cookie']",
	"authorization",
	"cookie",
	"apiKey",
	"accessToken",
	"refreshToken",
	"token",
	"secret",
	"signingSecret",
	"signature",
	"password",
	"prompt",
	"rawModelContent",
	"email",
	"to",
	"from",
	"user.email",
	"subscriber.email",
	"providerConfig.apiKey",
	"providerConfig.signingSecret",
	"*.apiKey",
	"*.accessToken",
	"*.refreshToken",
	"*.token",
	"*.secret",
	"*.signingSecret",
	"*.signature",
	"*.password",
	"*.prompt",
	"*.rawModelContent",
	"*.email",
	"*.to",
	"*.from",
] as const

export function resolveLogLevel(
	nodeEnv = env.NODE_ENV,
	requestedLevel: pino.LevelWithSilent = env.LOG_LEVEL,
	debugEnabled = env.LOG_DEBUG_ENABLED,
): pino.LevelWithSilent {
	if (
		nodeEnv === "production" &&
		(requestedLevel === "debug" || requestedLevel === "trace") &&
		!debugEnabled
	) {
		return "info"
	}
	return requestedLevel
}

export const logger = pino({
	name: "varta",
	level: resolveLogLevel(),
	mixin: currentLogContext,
	redact: {
		paths: [...LOGGER_REDACTION_PATHS],
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

if (
	env.NODE_ENV === "production" &&
	env.LOG_DEBUG_ENABLED &&
	(logger.level === "debug" || logger.level === "trace")
) {
	const debugTimer = setTimeout(() => {
		logger.level = "info"
		logger.info(
			logEvent("security", "logging.debug_expired", {}, "disabled"),
			"Bounded debug logging expired",
		)
	}, env.LOG_DEBUG_TTL_SECONDS * 1_000)
	debugTimer.unref()
}
