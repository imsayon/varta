import "dotenv/config"
import "./infra/observability/tracing.ts"
import { createServer } from "node:http"
import { app } from "./app.ts"
import { env } from "./common/config/env.ts"
import { logger } from "@/infra/observability/logger.ts"
import { disconnectDatabase } from "@/infra/database/prisma.ts"
import { connectRedis, disconnectRedis } from "@/infra/redis/redis.connection.ts"
import { stopTracing } from "@/infra/observability/tracing.ts"
import { closeQueues } from "@/infra/queues/queue.factory.ts"
import {
	startWebSocketServer,
	stopWebSocketServer,
} from "@/infra/realtime/websocket.server.ts"
import {
	closeHttpServer,
	listen,
	shutdownResources,
} from "@/runtime/shutdown.ts"
import { beginDrain, markStarted } from "@/runtime/lifecycle.ts"

const server = createServer(app)
let shuttingDown = false

try {
	await connectRedis()
	await startWebSocketServer(server)
	await listen(server, env.PORT)
	markStarted()
	logger.info({ port: env.PORT, service: env.SERVICE_NAME }, "Varta API started")
} catch (error: unknown) {
	logger.fatal({ err: error }, "Varta API startup failed")
	await shutdownResources(
		[
			[() => closeHttpServer(server), () => stopWebSocketServer(server)],
			[() => closeQueues()],
			[
				() => disconnectDatabase(),
				() => disconnectRedis(),
			],
			[() => stopTracing()],
		],
		env.SHUTDOWN_TIMEOUT_MS,
	)
	process.exitCode = 1
}

async function gracefulShutdown(signal: string): Promise<void> {
	if (shuttingDown) return
	shuttingDown = true
	beginDrain()
	logger.info({ signal }, "API shutdown started")
	const result = await shutdownResources(
		[
			[() => closeHttpServer(server), () => stopWebSocketServer(server)],
			[() => closeQueues()],
			[
				() => disconnectDatabase(),
				() => disconnectRedis(),
			],
			[() => stopTracing()],
		],
		env.SHUTDOWN_TIMEOUT_MS,
	)
	if (result.failures.length > 0)
		logger.error({ failures: result.failures }, "API shutdown encountered errors")
	if (result.timedOut) {
		logger.error("API shutdown timed out")
		process.exit(1)
	}
	logger.info("API shutdown complete")
	process.exit(0)
}

process.once("SIGINT", () => void gracefulShutdown("SIGINT"))
process.once("SIGTERM", () => void gracefulShutdown("SIGTERM"))
