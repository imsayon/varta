import { RateLimiterRedis } from "rate-limiter-flexible"
import { env } from "@/common/config/env.ts"
import { ForbiddenError, ServiceUnavailableError, TooManyRequestsError } from "@/common/errors/app-error.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import type { AIFeature } from "./ai.types.ts"
import { AI_FEATURES, AI_DEFAULTS, AI_REDIS_KEY_PREFIX } from "./ai.constants.ts"

const limiter = new RateLimiterRedis({
	storeClient: redis,
	keyPrefix: AI_REDIS_KEY_PREFIX,
	points: env.AI_REQUESTS_PER_MINUTE || AI_DEFAULTS.requestsPerMinute,
	duration: env.AI_RATE_LIMIT_WINDOW_SECONDS || AI_DEFAULTS.rateLimitWindowSeconds,
})

export const aiPolicy = {
	async authorize(workspaceId: string, feature: AIFeature) {
		if (!env.AI_ENABLED) throw new ServiceUnavailableError("AI features are disabled")
		if (feature === AI_FEATURES.SEND_TIME_OPTIMIZATION && !env.AI_SEND_TIME_OPTIMIZATION_ENABLED) {
			throw new ForbiddenError("Send-time optimization is disabled")
		}
		try {
			await limiter.consume(workspaceId)
		} catch (error) {
			if (error instanceof TooManyRequestsError) throw error
			throw new TooManyRequestsError("Too many AI requests")
		}
	},
}
