import { Router } from "express"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import { analyticsQuerySchema } from "./analytics.schema.ts"
import * as controller from "./analytics.controller.ts"

const router = Router({ mergeParams: true })
router.use(authenticate)
router.get("/overview", validate(analyticsQuerySchema, "query"), controller.overview)
router.get("/delivery-timeline", validate(analyticsQuerySchema, "query"), controller.deliveryTimeline)
router.get("/channel-breakdown", validate(analyticsQuerySchema, "query"), controller.channelBreakdown)
router.get("/top-templates", validate(analyticsQuerySchema, "query"), controller.topTemplates)

export { router as analyticsRouter }
