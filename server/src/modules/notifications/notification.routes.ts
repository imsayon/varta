import { Router } from "express"
import * as notificationController from "./notification.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import { triggerNotificationSchema } from "./notification.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { apiKeyAuth } from "@/common/middleware/api-key.middleware.ts"
import { rateLimitWorkspaceTrigger } from "@/common/middleware/rate-limit.middleware.ts"

const router = Router({ mergeParams: true })

// Dashboard reads — authenticated via session JWT
router.get("/", authenticate, notificationController.list)
router.get("/:notificationId", authenticate, notificationController.getById)
router.patch("/:notificationId/read", authenticate, notificationController.markRead)

// Trigger and retry — authenticated via API key or session JWT
const triggerAuth = (req: any, res: any, next: any) => {
	if (req.headers["x-api-key"]) {
		return apiKeyAuth(req, res, next)
	}
	return authenticate(req, res, next)
}

router.post(
	"/trigger",
	triggerAuth,
	rateLimitWorkspaceTrigger,
	validate(triggerNotificationSchema),
	notificationController.trigger,
)
router.post("/:notificationId/retry", triggerAuth, notificationController.retry)

export { router as notificationRouter }
