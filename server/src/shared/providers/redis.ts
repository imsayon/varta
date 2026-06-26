import { Redis } from "ioredis"
import { env } from "@/shared/config/env.ts"

export const redis = new Redis(env.REDIS_URL, {
	maxRetriesPerRequest: null,
	enableReadyCheck: false,
})

redis.on("error", (err) => {
	console.error("❌ Redis connection error:", err)
})

process.on("SIGTERM", async () => {
	await redis.quit()
})

process.on("SIGINT", async () => {
	await redis.quit()
})
