import { Router } from "express"
import * as notificationController from "./notification.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import { triggerNotificationSchema } from "./notification.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { authenticateAny } from "@/common/middleware/auth.middleware.ts"
import { rateLimitWorkspaceTrigger } from "@/common/middleware/rate-limit.middleware.ts"
import { authorize } from "@/common/auth/route-policy.ts"

const router = Router({ mergeParams: true })

// Dashboard reads — authenticated via session JWT
router.get("/", authenticate, authorize("notification.list"), notificationController.list)
router.get("/:notificationId", authenticate, authorize("notification.read"), notificationController.getById)
router.patch("/:notificationId/read", authenticate, authorize("notification.markRead"), notificationController.markRead)

// Trigger and retry — authenticated via API key or session JWT
router.post(
	"/trigger",
	authenticateAny,
	authorize("notification.trigger"),
	rateLimitWorkspaceTrigger,
	validate(triggerNotificationSchema),
	notificationController.trigger,
)
router.post("/:notificationId/retry", authenticateAny, authorize("notification.retry"), notificationController.retry)

export { router as notificationRouter }
