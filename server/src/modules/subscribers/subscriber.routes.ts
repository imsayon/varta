import { Router } from "express"
import * as subscriberController from "./subscriber.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import {
	createSubscriberSchema,
	updateSubscriberSchema,
} from "./subscriber.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { authorize } from "@/common/auth/route-policy.ts"

const router = Router({ mergeParams: true })
router.use(authenticate)

router.post(
	"/",
	authorize("subscriber.create"),
	validate(createSubscriberSchema),
	subscriberController.createOrUpdate,
)
router.get("/", authorize("subscriber.list"), subscriberController.list)
router.get("/:subscriberId", authorize("subscriber.read"), subscriberController.getById)
router.post("/:subscriberId/ws-token", authorize("subscriber.wsToken"), subscriberController.issueWebSocketToken)
router.patch(
	"/:subscriberId",
	authorize("subscriber.update"),
	validate(updateSubscriberSchema),
	subscriberController.update,
)
router.delete("/:subscriberId", authorize("subscriber.delete"), subscriberController.remove)

export { router as subscriberRouter }
