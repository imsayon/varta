import { Router } from "express"
import * as workspaceController from "./workspace.controller.ts"
import { validate } from "../../shared/middleware/validate.middleware.ts"
import {
	createWorkspaceSchema,
	updateWorkspaceSchema,
} from "./workspace.schema.ts"

const router = Router()

router.get("/", workspaceController.list)
router.post("/", validate(createWorkspaceSchema), workspaceController.create)
router.get("/:workspaceId", workspaceController.getById)
router.patch(
	"/:workspaceId",
	validate(updateWorkspaceSchema),
	workspaceController.update,
)
router.delete("/:workspaceId", workspaceController.remove)

export { router as workspaceRouter }
