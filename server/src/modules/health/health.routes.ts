import { Router } from "express"
import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"

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

export { router as healthRouter }
