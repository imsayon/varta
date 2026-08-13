import type { Request, Response, NextFunction } from "express"
import { apiKeyService } from "./api-key.service.ts"
import { workspaceService } from "../workspaces/workspace.service.ts"
import { requireWorkspaceCapability } from "@/common/auth/capability.ts"
import { sendSuccess } from "@/common/utils/response.ts"
import { parsePaginationQuery } from "@/common/utils/pagination.ts"

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
			req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
		)
		sendSuccess(req, res, apiKey, 201)
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
		const { page, limit } = parsePaginationQuery(req.query as Record<string, unknown>)
		const keys = await apiKeyService.list(workspaceId, (page - 1) * limit, limit + 1)
		const hasMore = keys.length > limit
		sendSuccess(req, res, hasMore ? keys.slice(0, limit) : keys, 200, { page, limit, hasMore })
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
		sendSuccess(req, res, null)
	} catch (err) {
		next(err)
	}
}
