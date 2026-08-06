import type { Request, Response, NextFunction } from "express"
import { apiKeyService } from "./api-key.service.ts"
import { workspaceService } from "../workspaces/workspace.service.ts"
import { requireWorkspaceCapability } from "@/common/auth/capability.ts"

export const create = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = requireWorkspaceCapability(req).actorId
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertAdmin(workspaceId, userId)
		const apiKey = await apiKeyService.create(
			workspaceId,
			req.body.name,
			req.body.permissions,
		)
		res.status(201).json({ success: true, data: apiKey })
	} catch (err) {
		next(err)
	}
}

export const list = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = requireWorkspaceCapability(req).actorId
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)
		const keys = await apiKeyService.list(workspaceId)
		res.status(200).json({ success: true, data: keys })
	} catch (err) {
		next(err)
	}
}

export const remove = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = requireWorkspaceCapability(req).actorId
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertAdmin(workspaceId, userId)
		await apiKeyService.revoke(workspaceId, req.params.keyId as string)
		res.status(200).json({ success: true, message: "API key revoked" })
	} catch (err) {
		next(err)
	}
}
