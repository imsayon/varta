import { createClient } from "redis"
import { env } from "@/common/config/env.ts"
import { logger } from "@/infra/observability/logger.ts"

const MAX_RECONNECT_ATTEMPTS = 10

export function redisReconnectStrategy(retries: number): number | false {
	if (retries > MAX_RECONNECT_ATTEMPTS) {
		logger.error("Redis: max retry attempts reached, giving up")
		return false
	}
	return Math.min((retries + 1) * 200, 5_000)
}

export const redis = createClient({
	url: env.REDIS_URL,
	socket: {
		reconnectStrategy: redisReconnectStrategy,
	},
})

redis.on("connect", () => logger.info("Redis connected"))
redis.on("ready", () => logger.info("Redis ready"))
redis.on("reconnecting", () => logger.warn("Redis reconnecting"))
redis.on("error", (err: Error) =>
	logger.error({ err }, "Redis connection error"),
)
redis.on("end", () => logger.info("Redis connection ended"))

let connectionPromise: Promise<void> | undefined

export async function connectRedis(): Promise<void> {
	if (redis.isReady) return
	if (!connectionPromise) {
		connectionPromise = redis
			.connect()
			.then(() => undefined)
			.finally(() => {
				connectionPromise = undefined
			})
	}
	await connectionPromise
}

export async function disconnectRedis(): Promise<void> {
	if (!redis.isOpen) return
	await redis.quit()
}
