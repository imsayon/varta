import type { Request, Response, NextFunction } from "express"
import { workspaceService } from "./workspace.service.ts"
import { requireCapability } from "@/common/auth/capability.ts"
import { sendSuccess, sendPaginated } from "@/common/utils/response.ts"
import { ForbiddenError } from "@/common/errors/app-error.ts"
import { parsePaginationQuery } from "@/common/utils/pagination.ts"
import { generateWorkspaceWebSocketToken } from "@/common/utils/auth/websocket-token.ts"

export const create = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = requireCapability(req).principal.actorId as string
		const workspace = await workspaceService.create(req.body.name, userId)
		sendSuccess(req, res, workspace, 201)
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
		const userId = requireCapability(req).principal.actorId as string
		const { limit } = parsePaginationQuery(req.query as Record<string, unknown>)
		const workspaces = await workspaceService.listByUser(userId, 0, limit + 1)
		const hasMore = workspaces.length > limit
		const items = hasMore ? workspaces.slice(0, limit) : workspaces
		sendPaginated(req, res, items, null, hasMore)
	} catch (err) {
		next(err)
	}
}

export const getById = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = requireCapability(req).principal.actorId as string
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)
		const workspace = await workspaceService.findById(workspaceId)
		sendSuccess(req, res, workspace)
	} catch (err) {
		next(err)
	}
}

export const update = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = requireCapability(req).principal.actorId as string
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertAdmin(workspaceId, userId)
		const workspace = await workspaceService.update(workspaceId, req.body)
		sendSuccess(req, res, workspace)
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
		const userId = requireCapability(req).principal.actorId as string
		const workspaceId = req.params.workspaceId as string
		const member = await workspaceService.assertMembership(
			workspaceId,
			userId,
		)
		if (member.role !== "OWNER") {
			throw new ForbiddenError("Only the workspace owner can delete it")
		}
		await workspaceService.delete(workspaceId)
		sendSuccess(req, res, null)
	} catch (err) {
		next(err)
	}
}

export const listMembers = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = requireCapability(req).principal.actorId as string
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)
		const { limit } = parsePaginationQuery(req.query as Record<string, unknown>)
		const members = await workspaceService.listMembers(workspaceId, 0, limit + 1)
		const hasMore = members.length > limit
		const items = hasMore ? members.slice(0, limit) : members
		sendPaginated(req, res, items, null, hasMore)
	} catch (err) {
		next(err)
	}
}

export const issueWebSocketToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		const userId = requireCapability(req).principal.actorId as string
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)
		const token = await generateWorkspaceWebSocketToken({ sub: userId, workspaceId })
		sendSuccess(req, res, { token, expiresInSeconds: 300 })
	} catch (error) {
		next(error)
	}
}
