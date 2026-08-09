import type { Request, Response, NextFunction } from "express"
import { RateLimiterRedis } from "rate-limiter-flexible"
import { redis } from "@/infra/redis/redis.connection.ts"
import { TooManyRequestsError } from "@/common/errors/app-error.ts"
import { logger } from "@/infra/observability/logger.ts"
import { ServiceUnavailableError } from "@/common/errors/app-error.ts"

function retryAfterSeconds(error: object): number {
	const milliseconds =
		"msBeforeNext" in error && typeof error.msBeforeNext === "number"
			? error.msBeforeNext
			: 60_000
	return Math.max(1, Math.ceil(milliseconds / 1000))
}

const authLimiter = new RateLimiterRedis({
	storeClient: redis,
	keyPrefix: "rl_auth",
	points: 5, // 5 requests
	duration: 60 * 15, // per 15 minutes by IP
})

const globalLimiter = new RateLimiterRedis({
	storeClient: redis,
	keyPrefix: "rl_global",
	points: 300, // Allow normal dashboard navigation and parallel asset/API loading.
	duration: 60, // per minute by IP
})

const workspaceTriggerLimiter = new RateLimiterRedis({
	storeClient: redis,
	keyPrefix: "rl_trigger",
	points: 60, // 60 requests
	duration: 60, // per minute by workspace
})

export async function rateLimitAuth(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const key = `${req.ip}_${req.body.email?.toLowerCase() ?? "unknown"}`
		await authLimiter.consume(key)
		next()
	} catch (error) {
		if (error && typeof error === "object" && "msBeforeNext" in error) {
			next(
				new TooManyRequestsError(
					"Too many authentication attempts, please try again later.",
					retryAfterSeconds(error),
				),
			)
		} else {
			logger.error({ err: error }, "Auth rate limiter unavailable")
			next(new ServiceUnavailableError("Authentication rate limiter unavailable"))
		}
	}
}

export async function rateLimitGlobal(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const key = req.ip || "unknown_ip"
		await globalLimiter.consume(key)
		next()
	} catch (error) {
		if (error && typeof error === "object" && "msBeforeNext" in error) {
			next(
				new TooManyRequestsError(
					"Global rate limit exceeded, please slow down.",
					retryAfterSeconds(error),
				),
			)
		} else {
			// Fail open on Redis error so system stays functional
			logger.warn(
				{ err: error },
				"Global rate limiter error - failing open",
			)
			next()
		}
	}
}

export async function rateLimitWorkspaceTrigger(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const rawWorkspaceId =
			req.params.workspaceId ||
			req.capability?.workspace?.workspaceId ||
			req.ip ||
			"unknown"
		const workspaceIdKey = Array.isArray(rawWorkspaceId)
			? (rawWorkspaceId[0] ?? "unknown")
			: String(rawWorkspaceId)
		await workspaceTriggerLimiter.consume(workspaceIdKey)
		next()
	} catch (error) {
		if (error && typeof error === "object" && "msBeforeNext" in error) {
			next(
				new TooManyRequestsError(
					"Workspace trigger rate limit exceeded (max 60 requests per minute).",
					retryAfterSeconds(error),
				),
			)
		} else {
			logger.error({ err: error }, "Workspace trigger rate limiter unavailable")
			next(new ServiceUnavailableError("Workspace trigger rate limiter unavailable"))
		}
	}
}
