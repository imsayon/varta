import { redis } from "@/infra/redis/connection.ts"

export const idempotencyService = {
	generateKey(workspaceId: string, idempotencyKey: string): string {
		return `idempotency:${workspaceId}:${idempotencyKey}`
	},

	async acquireLock(
		workspaceId: string,
		idempotencyKey: string,
		ttlSeconds: number = 86400,
	): Promise<boolean> {
		const redisKey = this.generateKey(workspaceId, idempotencyKey)
		const set = await redis.set(redisKey, "locked", "EX", ttlSeconds, "NX")
		return set === "OK"
	},

	async releaseLock(
		workspaceId: string,
		idempotencyKey: string,
	): Promise<void> {
		const redisKey = this.generateKey(workspaceId, idempotencyKey)
		await redis.del(redisKey)
	},
}
