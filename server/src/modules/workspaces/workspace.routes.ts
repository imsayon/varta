import { Router } from "express"
import * as workspaceController from "./workspace.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import {
	createWorkspaceSchema,
	updateWorkspaceSchema,
} from "./workspace.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"

const router = Router()
router.use(authenticate)

router.post("/", validate(createWorkspaceSchema), workspaceController.create)
router.get("/", workspaceController.list)
router.get("/:workspaceId", workspaceController.getById)
router.patch(
	"/:workspaceId",
	validate(updateWorkspaceSchema),
	workspaceController.update,
)
router.delete("/:workspaceId", workspaceController.remove)
router.get("/:workspaceId/members", workspaceController.listMembers)

export { router as workspaceRouter }
