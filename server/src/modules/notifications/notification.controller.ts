import type { Request, Response, NextFunction } from "express"
import type { TriggerNotificationRequest } from "./notification.schema.ts"
import { notificationOrchestrator } from "./notification.orchestrator.ts"
import { notificationRepository } from "./notification.repository.ts"
import { NotFoundError, BadRequestError } from "@/common/errors/app-error.ts"

export const trigger = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const workspaceId = req.params.workspaceId

		if (typeof workspaceId !== "string") {
			throw new Error("Invalid workspace id.")
		}
		if (!workspaceId) {
			res.status(400).json({
				success: false,
				message: "Workspace id is required.",
			})
			return
		}

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
		const workspaceId = req.params.workspaceId

		if (typeof workspaceId !== "string") {
			throw new Error("Invalid workspace id.")
		}
		if (!workspaceId) {
			res.status(400).json({
				success: false,
				message: "Workspace id is required.",
			})
			return
		}

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
		const workspaceId = req.params.workspaceId

		if (typeof workspaceId !== "string") {
			throw new Error("Invalid workspace id.")
		}
		const notificationId = req.params.notificationId

		if (typeof notificationId !== "string") {
			throw new Error("Invalid workspace id.")
		}
		if (!workspaceId || !notificationId) {
			res.status(400).json({
				success: false,
				message: "Workspace id and notification id are required.",
			})
			return
		}

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

// Re-enqueues a FAILED notification through the full orchestrator pipeline.
// Uses a fresh idempotency key so the retry is treated as a new delivery attempt.
export const retry = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const workspaceId = req.params.workspaceId as string
		const notificationId = req.params.notificationId as string

		const notification = await notificationRepository.findById(workspaceId, notificationId)
		if (!notification) throw new NotFoundError("Notification not found")
		if (notification.status !== "FAILED") {
			throw new BadRequestError("Only FAILED notifications can be retried")
		}

		const result = await notificationOrchestrator.triggerNotification(
			workspaceId!,
			crypto.randomUUID(), // fresh key — bypasses idempotency for explicit retry
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
