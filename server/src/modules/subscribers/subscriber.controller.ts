import type { Request, Response, NextFunction } from "express"
import { subscriberService } from "./subscriber.service.ts"
import { workspaceService } from "../workspaces/workspace.service.ts"

export const createOrUpdate = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = (req.user as any).id
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const subscriber = req.body.externalId
			? await subscriberService.upsert(
					workspaceId,
					req.body.externalId,
					req.body,
				)
			: await subscriberService.create({ ...req.body, workspaceId })

		res.status(201).json({ success: true, data: subscriber })
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
		const userId = (req.user as any).id
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const page = Math.max(1, parseInt(req.query.page as string) || 1)
		const limit = Math.min(
			100,
			Math.max(1, parseInt(req.query.limit as string) || 20),
		)
		const skip = (page - 1) * limit

		const [subscribers, total] = await subscriberService.search(
			workspaceId,
			skip,
			limit,
		)
		res.status(200).json({
			success: true,
			data: { subscribers, total, page, limit },
		})
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
		const userId = (req.user as any).id
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const subscriber = await subscriberService.findById(
			workspaceId,
			req.params.subscriberId as string,
		)
		if (!subscriber) {
			res.status(404).json({
				success: false,
				message: "Subscriber not found",
			})
			return
		}

		res.status(200).json({ success: true, data: subscriber })
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
		const userId = (req.user as any).id
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const existing = await subscriberService.findById(
			workspaceId,
			req.params.subscriberId as string,
		)
		if (!existing) {
			res.status(404).json({
				success: false,
				message: "Subscriber not found",
			})
			return
		}

		const subscriber = await subscriberService.update(
			workspaceId,
			req.params.subscriberId as string,
			req.body,
		)
		res.status(200).json({ success: true, data: subscriber })
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
		const userId = (req.user as any).id
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const existing = await subscriberService.findById(
			workspaceId,
			req.params.subscriberId as string,
		)
		if (!existing) {
			res.status(404).json({
				success: false,
				message: "Subscriber not found",
			})
			return
		}

		await subscriberService.delete(
			workspaceId,
			req.params.subscriberId as string,
		)
		res.status(200).json({ success: true, message: "Subscriber deleted" })
	} catch (err) {
		next(err)
	}
}
