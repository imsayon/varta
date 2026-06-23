import { Router } from "express"
import * as ctrl from "./template.controller.ts"
import { validate } from "../../shared/middleware/validate.middleware.ts"
import {
	createTemplateSchema,
	updateTemplateSchema,
} from "./template.schema.ts"

const router = Router({ mergeParams: true })

router.get("/", ctrl.list)
router.post("/", validate(createTemplateSchema), ctrl.create)
router.get("/:templateId", ctrl.getById)
router.patch("/:templateId", validate(updateTemplateSchema), ctrl.update)
router.delete("/:templateId", ctrl.remove)
router.post("/:templateId/preview", ctrl.preview)

export { router as templateRouter }
