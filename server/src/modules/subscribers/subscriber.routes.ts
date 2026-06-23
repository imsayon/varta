import { Router } from "express"
import * as ctrl from "./subscriber.controller.ts"
import { validate } from "../../shared/middleware/validate.middleware.ts"
import {
	createSubscriberSchema,
	updateSubscriberSchema,
} from "./subscriber.schema.ts"

const router = Router({ mergeParams: true })

router.get("/", ctrl.list)
router.post("/", validate(createSubscriberSchema), ctrl.create)
router.get("/:subscriberId", ctrl.getById)
router.patch("/:subscriberId", validate(updateSubscriberSchema), ctrl.update)
router.delete("/:subscriberId", ctrl.remove)

export { router as subscriberRouter }
