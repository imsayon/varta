import type { Request, Response, NextFunction } from "express"
import type { TriggerNotificationRequest } from "./notification.schema.ts"
import { notificationOrchestrator } from "./notification.orchestrator.ts"
import { notificationRepository } from "./notification.repository.ts"
import {
	NotFoundError,
	BadRequestError,
	ForbiddenError,
} from "@/common/errors/app-error.ts"
import { workspaceService } from "../workspaces/workspace.service.ts"
import { requireWorkspaceCapability } from "@/common/auth/capability.ts"

function assertApiKeyWorkspace(req: Request, workspaceId: string) {
	if (requireWorkspaceCapability(req).workspaceId !== workspaceId) {
		throw new ForbiddenError("API key does not belong to this workspace")
	}
}

export const trigger = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const workspaceId = req.params.workspaceId as string
		assertApiKeyWorkspace(req, workspaceId)

		const idempotencyKey =
			req.header("Idempotency-Key") ?? crypto.randomUUID()

		const body = req.body as TriggerNotificationRequest

		const result = await notificationOrchestrator.triggerNotification(
			workspaceId,
			idempotencyKey,
			body,
		)

		res.status(202).json({
			success: true,
			data: result,
		})
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
		const workspaceId = req.params.workspaceId as string
		const userId = requireWorkspaceCapability(req).actorId
		await workspaceService.assertMembership(workspaceId, userId)

		const page = Number(req.query.page ?? 1)
		const limit = Number(req.query.limit ?? 20)
		const skip = (page - 1) * limit

		const [notifications, total] = await notificationRepository.findMany(
			workspaceId,
			skip,
			limit,
		)

		res.status(200).json({
			success: true,
			data: {
				notifications,
				total,
				page,
				limit,
			},
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
		const workspaceId = req.params.workspaceId as string
		const notificationId = req.params.notificationId as string
		const userId = requireWorkspaceCapability(req).actorId
		await workspaceService.assertMembership(workspaceId, userId)

		const notification = await notificationRepository.findById(
			workspaceId,
			notificationId,
		)

		if (!notification) {
			res.status(404).json({
				success: false,
				message: "Notification not found.",
			})
			return
		}

		res.status(200).json({
			success: true,
			data: notification,
		})
	} catch (err) {
		next(err)
	}
}

export const markRead = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const workspaceId = req.params.workspaceId as string
		const notificationId = req.params.notificationId as string
		await workspaceService.assertMembership(workspaceId, requireWorkspaceCapability(req).actorId)
		const notification = await notificationRepository.markRead(workspaceId, notificationId)
		res.status(200).json({ success: true, data: notification })
	} catch (error) {
		next(error)
	}
}

export const retry = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const workspaceId = req.params.workspaceId as string
		const notificationId = req.params.notificationId as string
		assertApiKeyWorkspace(req, workspaceId)

		const notification = await notificationRepository.findById(workspaceId, notificationId)
		if (!notification) throw new NotFoundError("Notification not found")
		if (notification.status !== "FAILED") {
			throw new BadRequestError("Only FAILED notifications can be retried")
		}

		const result = await notificationOrchestrator.triggerNotification(
			workspaceId,
			crypto.randomUUID(),
			{
				templateId: notification.templateId,
				subscriberExternalId: notification.subscriber.externalId,
				payload: (notification.triggerPayload as Record<string, unknown>) ?? {},
			},
		)

		res.status(202).json({ success: true, data: result })
	} catch (err) {
		next(err)
	}
}
