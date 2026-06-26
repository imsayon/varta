import type { Request, Response, NextFunction } from "express"
import { RateLimiterRedis } from "rate-limiter-flexible"
import { redis } from "@/shared/providers/redis.ts"
import { TooManyRequestsError } from "@/shared/errors/app-error.ts"

const authLimiter = new RateLimiterRedis({
	storeClient: redis,
	keyPrefix: "rl_auth",
	points: 5, // 5 requests
	duration: 60 * 15, // per 15 minutes by IP
})

export async function rateLimitAuth(req: Request, res: Response, next: NextFunction) {
	try {
		const key = `${req.ip}_${req.body.email?.toLowerCase() ?? "unknown"}`
		await authLimiter.consume(key)
		next()
	} catch (rejRes) {
		next(new TooManyRequestsError("Too many login attempts, please try again later."))
	}
}
