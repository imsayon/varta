import { Router } from "express"
import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import { workerState } from "@/infra/workers/worker.bootstrap.ts"
import { authorize } from "@/common/auth/route-policy.ts"

const router = Router()

async function dependencyChecks(): Promise<{
	database: boolean
	redis: boolean
}> {
	const checks = await Promise.allSettled([
		prisma.$queryRaw`SELECT 1`,
		redis.ping(),
	])
	return {
		database: checks[0]?.status === "fulfilled",
		redis: checks[1]?.status === "fulfilled",
	}
}

router.get("/", authorize("health.read"), (_req, res) => {
	res.status(200).json({
		status: "ok",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	})
})

router.get("/live", authorize("health.live"), (_req, res) => {
	res.status(200).json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() })
})

router.get("/ready", authorize("health.ready"), async (_req, res) => {
	const checks = await dependencyChecks()
	const ready = checks.database && checks.redis
	res.status(ready ? 200 : 503).json({
		status: ready ? "ok" : "not_ready",
		checks: {
			database: checks.database ? "ok" : "failed",
			redis: checks.redis ? "ok" : "failed",
		},
	})
})

router.get("/combined/ready", authorize("health.combinedReady"), async (_req, res) => {
	const checks = await dependencyChecks()
	const worker = workerState.status === "ready"
	const ready = checks.database && checks.redis && worker
	res.status(ready ? 200 : 503).json({
		status: ready ? "ok" : "not_ready",
		checks: {
			database: checks.database ? "ok" : "failed",
			redis: checks.redis ? "ok" : "failed",
			worker: workerState.status,
		},
	})
})

router.get("/worker/ready", authorize("health.workerReady"), (_req, res) => {
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
