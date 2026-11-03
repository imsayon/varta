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

router.post("/", authenticate, authorize("workspace.create"), validate(createWorkspaceSchema), workspaceController.create)
router.get("/", authenticate, authorize("workspace.list"), workspaceController.list)
router.get("/:workspaceId", authenticate, authorize("workspace.read"), workspaceController.getById)
router.patch(
	"/:workspaceId",
	authenticate,
	authorize("workspace.update"),
	validate(updateWorkspaceSchema),
	workspaceController.update,
)
router.delete("/:workspaceId", authenticate, authorize("workspace.delete"), workspaceController.remove)
router.get("/:workspaceId/members", authenticate, authorize("workspace.members.list"), workspaceController.listMembers)
router.post("/:workspaceId/ws-token", authenticate, authorize("workspace.wsToken"), workspaceController.issueWebSocketToken)

export { router as workspaceRouter }
