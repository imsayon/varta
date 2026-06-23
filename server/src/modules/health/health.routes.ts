import { Router } from "express"

const router = Router()

router.get("/", (_req, res) => {
	res.status(200).json({
		status: "ok",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	})
})

export { router as healthRouter }
