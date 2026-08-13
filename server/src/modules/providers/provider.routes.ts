import { Router } from "express"
import * as providerController from "./provider.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import { upsertProviderConfigSchema } from "./provider.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { authorize } from "@/common/auth/route-policy.ts"

const router = Router({ mergeParams: true })

router.use(authenticate)

router.get("/", authorize("provider.list"), providerController.list)
router.put("/:channel", authorize("provider.upsert"), validate(upsertProviderConfigSchema), providerController.upsert)
router.post("/:channel/test", authorize("provider.test"), providerController.testConnection)

export { router as providerRouter }
