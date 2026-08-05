import { Router } from "express"
import * as subscriberController from "./subscriber.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import {
	createSubscriberSchema,
	updateSubscriberSchema,
} from "./subscriber.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"

const router = Router({ mergeParams: true })
router.use(authenticate)

router.post(
	"/",
	validate(createSubscriberSchema),
	subscriberController.createOrUpdate,
)
router.get("/", subscriberController.list)
router.get("/:subscriberId", subscriberController.getById)
router.post("/:subscriberId/ws-token", subscriberController.issueWebSocketToken)
router.patch(
	"/:subscriberId",
	validate(updateSubscriberSchema),
	subscriberController.update,
)
router.delete("/:subscriberId", subscriberController.remove)

export { router as subscriberRouter }
