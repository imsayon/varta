import "dotenv/config"
import "./infra/observability/tracing.ts"
import { createServer } from "node:http"
import { app } from "./app.ts"
import { env } from "./common/config/env.ts"
import { logger } from "@/infra/observability/logger.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import { stopTracing } from "@/infra/observability/tracing.ts"
import { closeQueues } from "@/infra/queues/queue.factory.ts"
import { startWorkers, stopWorkers } from "@/infra/workers/worker.bootstrap.ts"
import { startCombinedBackend } from "@/runtime/combined-startup.ts"
import {
	startWebSocketServer,
	stopWebSocketServer,
} from "@/infra/realtime/websocket.server.ts"
import {
	closeHttpServer,
	listen,
	shutdownResources,
} from "@/runtime/shutdown.ts"

const server = createServer(app)
let shuttingDown = false

async function cleanup(): Promise<Awaited<ReturnType<typeof shutdownResources>>> {
	return shutdownResources(
		[
			() => closeHttpServer(server),
			() => stopWebSocketServer(server),
			() => stopWorkers(),
			() => closeQueues(),
			() => prisma.$disconnect(),
			() => redis.quit().then(() => undefined),
			() => stopTracing(),
		],
		env.SHUTDOWN_TIMEOUT_MS,
	)
}

try {
	// Workers must be ready before the HTTP listener is exposed. This prevents
	// a combined Render service from reporting a healthy API with no consumer.
	await startCombinedBackend({
		startWorkers,
		startWebSocketServer: () => startWebSocketServer(server),
		listen: () => listen(server, env.PORT),
		stopWorkers,
	})
	logger.info(
		{ port: env.PORT, service: env.SERVICE_NAME },
		"Varta combined backend started",
	)
} catch (error: unknown) {
	logger.fatal({ err: error }, "Varta combined backend startup failed")
	const result = await cleanup()
	if (result.timedOut) process.exit(1)
	process.exitCode = 1
}

async function gracefulShutdown(signal: string): Promise<void> {
	if (shuttingDown) return
	shuttingDown = true
	logger.info({ signal }, "Combined backend shutdown started")
	const result = await cleanup()
	if (result.failures.length > 0)
		logger.error(
			{ failures: result.failures },
			"Combined backend shutdown encountered errors",
		)
	if (result.timedOut) {
		logger.error("Combined backend shutdown timed out")
		process.exit(1)
	}
	logger.info("Combined backend shutdown complete")
	process.exit(0)
}

process.once("SIGINT", () => void gracefulShutdown("SIGINT"))
process.once("SIGTERM", () => void gracefulShutdown("SIGTERM"))
