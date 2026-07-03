import { Router } from "express"
import * as notificationController from "./notification.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import { triggerNotificationSchema } from "./notification.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"

const router = Router({ mergeParams: true })

router.get("/", authenticate, notificationController.list)
router.get("/:notificationId", authenticate, notificationController.getById)
router.post(
	"/trigger",
	validate(triggerNotificationSchema),
	notificationController.trigger,
)

export { router as notificationRouter }
