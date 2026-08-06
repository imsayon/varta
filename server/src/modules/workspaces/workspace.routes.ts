import { Router } from "express"
import * as workspaceController from "./workspace.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import {
	createWorkspaceSchema,
	updateWorkspaceSchema,
} from "./workspace.schema.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { authorize } from "@/common/auth/route-policy.ts"

const router = Router()
router.use(authenticate)

router.post("/", authorize("workspace.create"), validate(createWorkspaceSchema), workspaceController.create)
router.get("/", authorize("workspace.list"), workspaceController.list)
router.get("/:workspaceId", authorize("workspace.read"), workspaceController.getById)
router.patch(
	"/:workspaceId",
	authorize("workspace.update"),
	validate(updateWorkspaceSchema),
	workspaceController.update,
)
router.delete("/:workspaceId", authorize("workspace.delete"), workspaceController.remove)
router.get("/:workspaceId/members", authorize("workspace.members.list"), workspaceController.listMembers)

export { router as workspaceRouter }
