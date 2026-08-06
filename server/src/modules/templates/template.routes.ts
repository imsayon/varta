import { Router } from "express"
import * as templateController from "./template.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import {
	createTemplateSchema,
	updateTemplateSchema,
	previewTemplateSchema,
} from "./template.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { authorize } from "@/common/auth/route-policy.ts"

const router = Router({ mergeParams: true })

router.use(authenticate)

router.get("/", authorize("template.list"), templateController.list)
router.post("/", authorize("template.create"), validate(createTemplateSchema), templateController.create)
router.post(
	"/preview",
	authorize("template.preview"),
	validate(previewTemplateSchema),
	templateController.preview,
)
router.get("/:templateId", authorize("template.read"), templateController.getById)
router.patch(
	"/:templateId",
	authorize("template.update"),
	validate(updateTemplateSchema),
	templateController.update,
)
router.delete("/:templateId", authorize("template.delete"), templateController.remove)

export { router as templateRouter }
