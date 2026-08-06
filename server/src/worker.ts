import "dotenv/config"
import "./infra/observability/tracing.ts"
import { createServer } from "node:http"
import { env } from "./common/config/env.ts"
import { logger } from "@/infra/observability/logger.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import {
	startWorkers,
	stopWorkers,
	workerState,
} from "@/infra/workers/worker.bootstrap.ts"
import { metricsRegistry } from "@/infra/observability/metrics.ts"
import { stopTracing } from "@/infra/observability/tracing.ts"
import { closeQueues } from "@/infra/queues/queue.factory.ts"
import {
	closeHttpServer,
	listen,
	shutdownResources,
} from "@/runtime/shutdown.ts"

const metricsServer = createServer(async (req, res) => {
	if (req.url === "/health/live") {
		res.writeHead(200, { "content-type": "application/json" }).end(
			JSON.stringify({ status: "ok" }),
		)
		return
	}
	if (req.url === "/health/ready") {
		const ready = workerState.status === "ready" && redis.status === "ready"
		res.writeHead(ready ? 200 : 503, {
			"content-type": "application/json",
		}).end(JSON.stringify({ status: ready ? "ok" : "not_ready" }))
		return
	}
	if (req.url === "/metrics") {
		res.writeHead(200, { "content-type": metricsRegistry.contentType })
		res.end(await metricsRegistry.metrics())
		return
	}
	res.writeHead(404).end()
})

try {
	await startWorkers()
	await listen(metricsServer, env.METRICS_PORT)
	logger.info({ port: env.METRICS_PORT }, "Worker metrics server started")
	logger.info({ service: "varta-worker" }, "Worker process started")
} catch (error: unknown) {
	logger.fatal({ err: error }, "Worker startup failed")
	const result = await shutdownResources(
		[
			() => closeHttpServer(metricsServer),
			() => stopWorkers(),
			() => closeQueues(),
			() => prisma.$disconnect(),
			() => redis.quit().then(() => undefined),
			() => stopTracing(),
		],
		env.SHUTDOWN_TIMEOUT_MS,
	)
	if (result.timedOut) process.exit(1)
	process.exitCode = 1
}

let shuttingDown = false
async function gracefulShutdown(signal: string): Promise<void> {
	if (shuttingDown) return
	shuttingDown = true
	logger.info({ signal }, "Worker shutdown started")
	const result = await shutdownResources(
		[
			() => closeHttpServer(metricsServer),
			() => stopWorkers(),
			() => closeQueues(),
			() => prisma.$disconnect(),
			() => redis.quit().then(() => undefined),
			() => stopTracing(),
		],
		env.SHUTDOWN_TIMEOUT_MS,
	)
	if (result.failures.length > 0)
		logger.error({ failures: result.failures }, "Worker shutdown encountered errors")
	if (result.timedOut) {
		logger.error("Worker shutdown timed out")
		process.exit(1)
	}
	logger.info("Worker shutdown complete")
	process.exit(0)
}

process.once("SIGINT", () => void gracefulShutdown("SIGINT"))
process.once("SIGTERM", () => void gracefulShutdown("SIGTERM"))
