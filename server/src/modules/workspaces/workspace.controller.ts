import type { Request, Response, NextFunction } from "express"
import { workspaceService } from "./workspace.service.ts"
import { requireCapability } from "@/common/auth/capability.ts"
import { sendSuccess } from "@/common/utils/response.ts"
import { ForbiddenError } from "@/common/errors/app-error.ts"
import { parsePaginationQuery } from "@/common/utils/pagination.ts"

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
		const { page, limit } = parsePaginationQuery(req.query as Record<string, unknown>)
		const workspaces = await workspaceService.listByUser(userId, (page - 1) * limit, limit + 1)
		const hasMore = workspaces.length > limit
		sendSuccess(req, res, hasMore ? workspaces.slice(0, limit) : workspaces, 200, { page, limit, hasMore })
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
		const { page, limit } = parsePaginationQuery(req.query as Record<string, unknown>)
		const members = await workspaceService.listMembers(workspaceId, (page - 1) * limit, limit + 1)
		const hasMore = members.length > limit
		sendSuccess(req, res, hasMore ? members.slice(0, limit) : members, 200, { page, limit, hasMore })
	} catch (err) {
		next(err)
	}
}
