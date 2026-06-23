import { Router } from "express"
const router = Router({ mergeParams: true })
router.get("/", (req, res) => { res.status(501).json({ error: "Not implemented" }) })
export { router as notificationRouter }
