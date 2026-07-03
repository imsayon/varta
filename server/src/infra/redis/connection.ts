/*
Redis Connection — Shared Redis singleton for the entire server
This is the ONE Redis client used by: rate limiter, sessions, cache,
idempotency checks, and any future use. BullMQ uses its own connection
via queue.connection.ts (BullMQ requires maxRetriesPerRequest: null).
 */
import { Redis } from "ioredis"
import { env } from "@/common/config/env.ts"
import { logger } from "@/infra/logger/logger.ts"

export const redis = new Redis(env.REDIS_URL, {
	maxRetriesPerRequest: null,
	enableReadyCheck: true,
	retryStrategy(times: number) {
		if (times > 10) {
			logger.error("Redis: max retry attempts reached, giving up")
			return null
		}
		return Math.min(times * 200, 5000)
	},
})

redis.on("connect", () => logger.info("Redis connected"))
redis.on("error", (err: Error) =>
	logger.error({ err }, "Redis connection error"),
)
