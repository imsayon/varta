import type { Request, Response, NextFunction } from "express"
import { subscriberService } from "./subscriber.service.ts"
import { generateSubscriberWebSocketToken } from "@/common/utils/auth/websocket-token.ts"
import { sendSuccess, sendPaginated } from "@/common/utils/response.ts"
import { NotFoundError } from "@/common/errors/app-error.ts"
import { parsePaginationQuery, encodeCursor, decodeCursor } from "@/common/utils/pagination.ts"

export const createOrUpdate = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const workspaceId = req.params.workspaceId as string
		const { externalId, email, name, timezone, locale, attributes, preferences } = req.body

		const payload = {
			workspaceId,
			externalId,
			...(email !== undefined ? { email } : {}),
			...(name !== undefined ? { name } : {}),
			timezone: timezone || "UTC",
			locale: locale || "en-US",
			attributes: attributes || {},
			preferences: preferences || {},
		}

		const subscriber = await subscriberService.upsert(
			workspaceId,
			externalId,
			payload,
		)

		sendSuccess(req, res, subscriber, 201)
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
		const { limit, cursor } = parsePaginationQuery(req.query as Record<string, unknown>)
		const decoded = decodeCursor(cursor)

		const [subscribers, total] = await subscriberService.search(
			workspaceId,
			limit + 1,
			decoded,
		)

		const hasMore = subscribers.length > limit
		const items = hasMore ? subscribers.slice(0, limit) : subscribers
		const lastItem = items.length > 0 ? items[items.length - 1] : undefined
		const nextCursor = hasMore && lastItem
			? encodeCursor({ id: lastItem.id, createdAt: lastItem.createdAt.toISOString() })
			: null

		sendPaginated(req, res, items, nextCursor, hasMore, total)
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
		const subscriberId = req.params.subscriberId as string

		const subscriber = await subscriberService.findById(workspaceId, subscriberId)
		if (!subscriber) {
			throw new NotFoundError("Subscriber not found")
		}

		sendSuccess(req, res, subscriber)
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
		const workspaceId = req.params.workspaceId as string
		const subscriberId = req.params.subscriberId as string

		const existing = await subscriberService.findById(workspaceId, subscriberId)
		if (!existing) {
			throw new NotFoundError("Subscriber not found")
		}

		const subscriber = await subscriberService.update(
			workspaceId,
			subscriberId,
			req.body,
		)
		sendSuccess(req, res, subscriber)
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
		const workspaceId = req.params.workspaceId as string
		const subscriberId = req.params.subscriberId as string

		const existing = await subscriberService.findById(workspaceId, subscriberId)
		if (!existing) {
			throw new NotFoundError("Subscriber not found")
		}

		await subscriberService.delete(workspaceId, subscriberId)
		sendSuccess(req, res, null)
	} catch (err) {
		next(err)
	}
}

export const issueWebSocketToken = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const workspaceId = req.params.workspaceId
		const subscriberId = req.params.subscriberId
		if (typeof workspaceId !== "string" || typeof subscriberId !== "string") {
			throw new Error("Workspace id and subscriber id are required")
		}
		const subscriber = await subscriberService.findById(workspaceId, subscriberId)
		if (!subscriber) {
			throw new NotFoundError("Subscriber not found")
		}
		const token = await generateSubscriberWebSocketToken({
			sub: subscriber.id,
			workspaceId,
		})
		sendSuccess(req, res, { token, expiresInSeconds: 300 })
	} catch (error) {
		next(error)
	}
}
