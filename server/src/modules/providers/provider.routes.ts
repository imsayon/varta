import { Router } from "express"
import * as providerController from "./provider.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import { upsertProviderConfigSchema } from "./provider.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"

const router = Router({ mergeParams: true })

router.use(authenticate)

router.get("/", providerController.list)
router.put("/:channel", validate(upsertProviderConfigSchema), providerController.upsert)
router.post("/:channel/test", providerController.testConnection)

export { router as providerRouter }
