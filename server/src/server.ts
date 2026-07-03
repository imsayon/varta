import "dotenv/config"
import { createServer } from "node:http"
import { app } from "./app.ts"
import { env } from "./common/config/env.ts"
import { logger } from "@/infra/logger/logger.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { startWorkers } from "@/infra/workers/worker.bootstrap.ts"

const server = createServer(app)

// Start HTTP server and background workers
server.listen(env.PORT, async () => {
	logger.info(`Varta API server running on http://localhost:${env.PORT}`)
	logger.info(`Environment: ${env.NODE_ENV}`)

	await startWorkers()
})

// Graceful shutdown — drain requests, close DB, exit
const gracefulShutdown = async (signal: string) => {
	logger.info(`${signal} received. Shutting down gracefully...`)

	server.close(async () => {
		await prisma.$disconnect()
		logger.info("Database connections closed")
		process.exit(0)
	})

	// Force exit if graceful shutdown takes too long
	setTimeout(() => {
		logger.error("Forced shutdown after timeout")
		process.exit(1)
	}, 10_000)
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"))
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
