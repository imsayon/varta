import { Router } from "express"
import * as notificationController from "./notification.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import { triggerNotificationSchema } from "./notification.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { apiKeyAuth } from "@/common/middleware/api-key.middleware.ts"

const router = Router({ mergeParams: true })

// Dashboard reads — authenticated via session JWT
router.get("/", authenticate, notificationController.list)
router.get("/:notificationId", authenticate, notificationController.getById)

// Trigger and retry — authenticated via API key (external callers)
router.post("/trigger", apiKeyAuth, validate(triggerNotificationSchema), notificationController.trigger)
router.post("/:notificationId/retry", apiKeyAuth, notificationController.retry)

export { router as notificationRouter }
