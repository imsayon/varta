import { Router } from "express"
import * as apiKeyController from "./api-key.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import { createApiKeySchema } from "./api-key.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"

const router = Router({ mergeParams: true })

router.use(authenticate)

router.get("/", apiKeyController.list)
router.post("/", validate(createApiKeySchema), apiKeyController.create)
router.delete("/:keyId", apiKeyController.remove)

export { router as apiKeyRouter }
