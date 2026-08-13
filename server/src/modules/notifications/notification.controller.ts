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
import { sendSuccess } from "@/common/utils/response.ts"
import { parsePaginationQuery } from "@/common/utils/pagination.ts"
import { decodeCursor, encodeCursor } from "@/common/utils/pagination.ts"
import type { NotificationStatus } from "@prisma/client"
import { logger } from "@/infra/observability/logger.ts"

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

		sendSuccess(req, res, result, 202)
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

		const { limit, cursor, search } = parsePaginationQuery(req.query as Record<string, unknown>)
		const decodedCursor = decodeCursor(cursor)
		const requestedStatus = typeof req.query.status === "string" ? req.query.status : undefined
		const allowedStatuses = new Set(["PENDING", "ENQUEUED", "PARTIAL", "DELIVERED", "FAILED"])
		const status = requestedStatus && allowedStatuses.has(requestedStatus)
			? requestedStatus as NotificationStatus
			: undefined

		const [notifications, total] = await notificationRepository.findMany(
			workspaceId,
			{ ...(decodedCursor ? { cursorId: decodedCursor.id } : {}), take: limit + 1, ...(status ? { status } : {}), ...(search ? { search } : {}) },
		)
		const hasMore = notifications.length > limit
		const items = hasMore ? notifications.slice(0, limit) : notifications
		const last = items.at(-1)
		const nextCursor = hasMore && last
			? encodeCursor({ id: last.id, createdAt: last.createdAt.toISOString() })
			: null

		sendSuccess(req, res, items, 200, {
			cursor: nextCursor,
			limit,
			total,
			hasMore,
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
			throw new NotFoundError("Notification not found")
		}

		sendSuccess(req, res, notification)
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
		sendSuccess(req, res, notification)
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
		logger.info({
			event: "notification.retry",
			workspaceId,
			notificationId,
			retryNotificationId: result.notificationId,
			actorId: requireWorkspaceCapability(req).actorId,
		}, "Notification retry accepted")

		sendSuccess(req, res, result, 202)
	} catch (err) {
		next(err)
	}
}
