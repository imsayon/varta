import { createClient } from "redis"
import {
	createNodeRedisClient,
	RedisConnection,
	type ConnectionOptions,
	type RedisOptions,
} from "bullmq"
import { env } from "@/common/config/env.ts"
import { redisReconnectStrategy } from "@/infra/redis/redis.connection.ts"

export interface QueueConnectionConfig {
	redisUrl: string
	serviceName: string
}

function createNodeRedisUrl(options: RedisOptions): string {
	if (options.url) return options.url
	const protocol = options.tls ? "rediss:" : "redis:"
	const username = options.username ? encodeURIComponent(options.username) : ""
	const password = options.password ? `:${encodeURIComponent(options.password)}` : ""
	const auth = username || password ? `${username}${password}@` : ""
	return `${protocol}//${auth}${options.host ?? "localhost"}:${options.port ?? 6379}`
}

RedisConnection.clientFactory = (options) => {
	const raw = createClient({
		url: createNodeRedisUrl(options),
		...(options.connectionName ? { name: options.connectionName } : {}),
		...(options.username ? { username: options.username } : {}),
		...(options.password ? { password: options.password } : {}),
		socket: {
			reconnectStrategy: redisReconnectStrategy,
			...(options.tls ? { tls: true } : {}),
		},
	})
	return createNodeRedisClient(raw)
}

export function createQueueConnection(config: QueueConnectionConfig): ConnectionOptions {
	const redisUrl = new URL(config.redisUrl)
	if (redisUrl.protocol !== "redis:" && redisUrl.protocol !== "rediss:") {
		throw new Error("REDIS_URL must use redis:// or rediss://")
	}
	return {
		url: config.redisUrl,
		host: redisUrl.hostname || "localhost",
		port: Number(redisUrl.port) || 6379,
		...(redisUrl.password
			? { password: decodeURIComponent(redisUrl.password) }
			: {}),
		...(redisUrl.username
			? { username: decodeURIComponent(redisUrl.username) }
			: {}),
		...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
		connectionName: `${config.serviceName}-bullmq`,
		maxRetriesPerRequest: null, // Required by BullMQ
	}
}

export function getQueueConnection(): ConnectionOptions {
	return createQueueConnection({ redisUrl: env.REDIS_URL, serviceName: env.SERVICE_NAME })
}

export function getQueuePrefix(): string {
	return env.REDIS_QUEUE_PREFIX
}
