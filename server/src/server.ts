import "dotenv/config"
import "./infra/observability/tracing.ts"
import { createServer } from "node:http"
import { app } from "./app.ts"
import { env } from "./common/config/env.ts"
import { logger } from "@/infra/observability/logger.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import { stopTracing } from "@/infra/observability/tracing.ts"
import {
	startWebSocketServer,
	stopWebSocketServer,
} from "@/infra/realtime/websocket.server.ts"

const server = createServer(app)
let shuttingDown = false

startWebSocketServer(server)
server.listen(env.PORT, () => {
	logger.info(
		{ port: env.PORT, service: env.SERVICE_NAME },
		"Varta API started",
	)
})

async function gracefulShutdown(signal: string): Promise<void> {
	if (shuttingDown) return
	shuttingDown = true
	logger.info({ signal }, "API shutdown started")
	const forceExit = setTimeout(() => {
		logger.error("API shutdown timed out")
		process.exit(1)
	}, env.SHUTDOWN_TIMEOUT_MS)
	forceExit.unref()
	server.close(async () => {
		await Promise.allSettled([
			stopWebSocketServer(server),
			prisma.$disconnect(),
			redis.quit(),
			stopTracing(),
		])
		clearTimeout(forceExit)
		logger.info("API shutdown complete")
		process.exit(0)
	})
}

process.once("SIGINT", () => void gracefulShutdown("SIGINT"))
process.once("SIGTERM", () => void gracefulShutdown("SIGTERM"))
