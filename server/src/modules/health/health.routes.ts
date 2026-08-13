import { Router } from "express"
import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import { workerState } from "@/infra/workers/worker.bootstrap.ts"
import { authorize } from "@/common/auth/route-policy.ts"
import { lifecycleState } from "@/runtime/lifecycle.ts"
import { dependencyReady } from "@/infra/observability/metrics.ts"

const router = Router()
const DEPENDENCY_CHECK_TIMEOUT_MS = 1_000

async function boundedCheck(operation: Promise<unknown>): Promise<boolean> {
	let timer: NodeJS.Timeout | undefined
	try {
		return await Promise.race([
			operation.then(() => true).catch(() => false),
			new Promise<boolean>((resolve) => {
				timer = setTimeout(() => resolve(false), DEPENDENCY_CHECK_TIMEOUT_MS)
			}),
		])
	} finally {
		if (timer) clearTimeout(timer)
	}
}

async function dependencyChecks(): Promise<{
	database: boolean
	redis: boolean
}> {
	const checks = await Promise.all([
		boundedCheck(prisma.$queryRaw`SELECT 1`),
		redis.isReady ? boundedCheck(redis.ping()) : Promise.resolve(false),
	])
	dependencyReady.set({ dependency: "postgres" }, checks[0] ? 1 : 0)
	dependencyReady.set({ dependency: "redis" }, checks[1] ? 1 : 0)
	return {
		database: checks[0] ?? false,
		redis: checks[1] ?? false,
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

router.get("/startup", authorize("health.startup"), (_req, res) => {
	res.status(lifecycleState.started ? 200 : 503).json({ status: lifecycleState.started ? "started" : "starting" })
})

router.get("/ready", authorize("health.ready"), async (_req, res) => {
	const checks = await dependencyChecks()
	const ready = checks.database && checks.redis && lifecycleState.started && !lifecycleState.draining
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
	const ready = checks.database && checks.redis && worker && lifecycleState.started && !lifecycleState.draining
	res.status(ready ? 200 : 503).json({
		status: ready ? "ok" : "not_ready",
		checks: {
			database: checks.database ? "ok" : "failed",
			redis: checks.redis ? "ok" : "failed",
			worker: workerState.status,
		},
	})
})

router.get("/worker/ready", authorize("health.workerReady"), async (_req, res) => {
	if (workerState.status === "not_started") {
		res.status(404).json({ status: "not_applicable" })
		return
	}

	const checks = await dependencyChecks()
	const ready = workerState.status === "ready" && checks.database && checks.redis && lifecycleState.started && !lifecycleState.draining
	res.status(ready ? 200 : 503).json({
		status: ready ? "ok" : "not_ready",
		checks: {
			worker: workerState.status,
			database: checks.database ? "ok" : "failed",
			redis: checks.redis ? "ok" : "failed",
		},
	})
})

export { router as healthRouter }
