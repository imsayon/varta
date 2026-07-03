import type { ConnectionOptions } from "bullmq"
import { env } from "@/common/config/env.ts"

export function getQueueConnection(): ConnectionOptions {
	return {
		host: new URL(env.REDIS_URL).hostname || "localhost",
		port: Number(new URL(env.REDIS_URL).port) || 6379,
		maxRetriesPerRequest: null, // Required by BullMQ
	}
}
