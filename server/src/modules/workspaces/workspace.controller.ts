import type { Request, Response, NextFunction } from "express"
import { workspaceService } from "./workspace.service.ts"

export const create = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = req.user!.id
		const workspace = await workspaceService.create(req.body.name, userId)
		res.status(201).json({ success: true, data: workspace })
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
		const userId = req.user!.id
		const workspaces = await workspaceService.listByUser(userId)
		res.status(200).json({ success: true, data: workspaces })
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
		const userId = req.user!.id
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)
		const workspace = await workspaceService.findById(workspaceId)
		res.status(200).json({ success: true, data: workspace })
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
		const userId = req.user!.id
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertAdmin(workspaceId, userId)
		const workspace = await workspaceService.update(workspaceId, req.body)
		res.status(200).json({ success: true, data: workspace })
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
		const userId = req.user!.id
		const workspaceId = req.params.workspaceId as string
		const member = await workspaceService.assertMembership(
			workspaceId,
			userId,
		)
		if (member.role !== "OWNER") {
			res.status(403).json({
				success: false,
				message: "Only the workspace owner can delete it",
			})
			return
		}
		await workspaceService.delete(workspaceId)
		res.status(200).json({ success: true, message: "Workspace deleted" })
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
		const userId = req.user!.id
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)
		const members = await workspaceService.listMembers(workspaceId)
		res.status(200).json({ success: true, data: members })
	} catch (err) {
		next(err)
	}
}
