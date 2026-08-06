import { Router } from "express"
import * as apiKeyController from "./api-key.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import { createApiKeySchema } from "./api-key.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { authorize } from "@/common/auth/route-policy.ts"

const router = Router({ mergeParams: true })

router.use(authenticate)

router.get("/", authorize("apiKey.list"), apiKeyController.list)
router.post("/", authorize("apiKey.create"), validate(createApiKeySchema), apiKeyController.create)
router.delete("/:keyId", authorize("apiKey.revoke"), apiKeyController.remove)

export { router as apiKeyRouter }
