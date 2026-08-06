import { Router } from "express"
import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import { workerState } from "@/infra/workers/worker.bootstrap.ts"

const router = Router()

router.get("/", (_req, res) => {
	res.status(200).json({
		status: "ok",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	})
})

router.get("/live", (_req, res) => {
	res.status(200).json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() })
})

router.get("/ready", async (_req, res) => {
	const checks = await Promise.allSettled([
		prisma.$queryRaw`SELECT 1`,
		redis.ping(),
	])
	const database = checks[0]?.status === "fulfilled"
	const cache = checks[1]?.status === "fulfilled"
	const ready = database && cache
	res.status(ready ? 200 : 503).json({
		status: ready ? "ok" : "not_ready",
		checks: { database: database ? "ok" : "failed", redis: cache ? "ok" : "failed" },
	})
})

router.get("/worker/ready", (_req, res) => {
	if (workerState.status === "not_started") {
		res.status(404).json({ status: "not_applicable" })
		return
	}

	const ready = workerState.status === "ready" && redis.status === "ready"
	res.status(ready ? 200 : 503).json({
		status: ready ? "ok" : "not_ready",
		checks: {
			worker: workerState.status,
			redis: redis.status === "ready" ? "ok" : "failed",
		},
	})
})

export { router as healthRouter }
