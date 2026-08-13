import type { Request, Response, NextFunction } from "express"
import { RateLimiterRedis } from "rate-limiter-flexible"
import { redis } from "@/infra/redis/redis.connection.ts"
import { TooManyRequestsError } from "@/common/errors/app-error.ts"
import { logger } from "@/infra/observability/logger.ts"
import { ServiceUnavailableError } from "@/common/errors/app-error.ts"
import { BILLING_CATALOG } from "@/modules/billing/billing.constants.ts"
import { billingService } from "@/modules/billing/billing.service.ts"

function retryAfterSeconds(error: object): number {
	const milliseconds =
		"msBeforeNext" in error && typeof error.msBeforeNext === "number"
			? error.msBeforeNext
			: 60_000
	return Math.max(1, Math.ceil(milliseconds / 1000))
}

const authLimiter = new RateLimiterRedis({
	storeClient: redis,
	useRedisPackage: true,
	keyPrefix: "rl_auth",
	points: 5, // 5 requests
	duration: 60 * 15, // per 15 minutes by IP
})

const globalLimiter = new RateLimiterRedis({
	storeClient: redis,
	useRedisPackage: true,
	keyPrefix: "rl_global",
	points: 300, // Allow normal dashboard navigation and parallel asset/API loading.
	duration: 60, // per minute by IP
})

const workspaceTriggerLimiters = new Map(
	Object.values(BILLING_CATALOG).map((plan) => [
		plan.limits.maxRps,
		new RateLimiterRedis({
			storeClient: redis,
			useRedisPackage: true,
			keyPrefix: `rl_trigger_${plan.limits.maxRps}`,
			points: plan.limits.maxRps,
			duration: 1,
		}),
	]),
)

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
	// Notification triggers have their own authenticated, workspace-scoped,
	// entitlement-aware limiter. An IP-wide dashboard limit must not silently
	// lower a paid workspace's published throughput contract.
	if (req.method === "POST" && /^\/workspaces\/[^/]+\/notifications\/trigger\/?$/.test(req.path)) {
		next()
		return
	}
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
		const entitlements = await billingService.getWorkspaceEntitlements(workspaceIdKey)
		const maxRps = entitlements.limits.maxRps
		const limiter = workspaceTriggerLimiters.get(maxRps)
		if (!limiter) throw new ServiceUnavailableError("Workspace throughput policy is invalid")
		await limiter.consume(workspaceIdKey)
		next()
	} catch (error) {
		if (error && typeof error === "object" && "msBeforeNext" in error) {
			next(
				new TooManyRequestsError(
					"Workspace trigger rate limit exceeded for the active plan.",
					retryAfterSeconds(error),
				),
			)
		} else {
			logger.error({ err: error }, "Workspace trigger rate limiter unavailable")
			next(new ServiceUnavailableError("Workspace trigger rate limiter unavailable"))
		}
	}
}
