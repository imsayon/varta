import type { Request } from "express"
import { ForbiddenError, UnauthorizedError } from "@/common/errors/app-error.ts"
import type { AuthorizationCapability, WorkspaceContext } from "./principal.ts"

export function requireCapability(req: Request): AuthorizationCapability {
	if (!req.capability) throw new UnauthorizedError("Authentication required")
	return req.capability
}

export function requireWorkspaceCapability(req: Request): WorkspaceContext {
	const capability = requireCapability(req)
	if (!capability.workspace) {
		throw new ForbiddenError("Workspace authorization required")
	}
	return capability.workspace
}
