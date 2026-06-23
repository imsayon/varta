import "dotenv/config"
import { createServer } from "node:http"
import { app } from "./app.ts"
import { env } from "./shared/config/env.ts"
import { logger } from "./shared/logger/logger.ts"
import { prisma } from "./shared/database/prisma.ts"

const server = createServer(app)

server.listen(env.PORT, () => {
	logger.info(`Varta API server running on http://localhost:${env.PORT}`)
	logger.info(`Environment: ${env.NODE_ENV}`)
})

const gracefulShutdown = async (signal: string) => {
	logger.info(`${signal} received. Shutting down gracefully...`)

	server.close(async () => {
		await prisma.$disconnect()
		logger.info("Database connections closed")
		process.exit(0)
	})

	// Force close after 10s
	setTimeout(() => {
		logger.error("Forced shutdown after timeout")
		process.exit(1)
	}, 10_000)
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"))
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
