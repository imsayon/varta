import type { ConnectionOptions } from "bullmq"
import { env } from "@/common/config/env.ts"

export function getQueueConnection(): ConnectionOptions {
	const redisUrl = new URL(env.REDIS_URL)
	return {
		host: redisUrl.hostname || "localhost",
		port: Number(redisUrl.port) || 6379,
		...(redisUrl.password
			? { password: decodeURIComponent(redisUrl.password) }
			: {}),
		...(redisUrl.username
			? { username: decodeURIComponent(redisUrl.username) }
			: {}),
		connectionName: `${env.SERVICE_NAME}-bullmq`,
		maxRetriesPerRequest: null, // Required by BullMQ
	}
}
