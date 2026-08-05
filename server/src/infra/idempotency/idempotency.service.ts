import { redis } from "@/infra/redis/redis.connection.ts"
import { logger } from "@/infra/observability/logger.ts"

export const idempotencyService = {
	generateKey(workspaceId: string, idempotencyKey: string): string {
		return `idempotency:${workspaceId}:${idempotencyKey}`
	},

	async acquireLock(
		workspaceId: string,
		idempotencyKey: string,
		ttlSeconds: number = 86400,
	): Promise<boolean> {
		try {
			const redisKey = this.generateKey(workspaceId, idempotencyKey)
			const set = await redis.set(
				redisKey,
				"locked",
				"EX",
				ttlSeconds,
				"NX",
			)
			return set === "OK"
		} catch (error) {
			logger.warn(
				{ err: error },
				"Idempotency Redis lock acquire failed - proceeding",
			)
			return true
		}
	},

	async releaseLock(
		workspaceId: string,
		idempotencyKey: string,
	): Promise<void> {
		try {
			const redisKey = this.generateKey(workspaceId, idempotencyKey)
			await redis.del(redisKey)
		} catch (error) {
			logger.warn({ err: error }, "Idempotency Redis lock release failed")
		}
	},
}
