import { Router } from "express"
import * as templateController from "./template.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import {
	createTemplateSchema,
	updateTemplateSchema,
	previewTemplateSchema,
} from "./template.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"

const router = Router({ mergeParams: true })

router.use(authenticate)

router.get("/", templateController.list)
router.post("/", validate(createTemplateSchema), templateController.create)
router.post(
	"/preview",
	validate(previewTemplateSchema),
	templateController.preview,
)
router.get("/:templateId", templateController.getById)
router.patch(
	"/:templateId",
	validate(updateTemplateSchema),
	templateController.update,
)
router.delete("/:templateId", templateController.remove)

export { router as templateRouter }
