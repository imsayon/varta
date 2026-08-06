import type { Request, Response, NextFunction } from "express"
import { subscriberService } from "./subscriber.service.ts"
import { generateSubscriberWebSocketToken } from "@/common/utils/auth/websocket-token.ts"
import { sendSuccess } from "@/common/utils/response.ts"
import { NotFoundError } from "@/common/errors/app-error.ts"
import { parsePaginationQuery } from "@/common/utils/pagination.ts"

export const createOrUpdate = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const workspaceId = req.params.workspaceId as string

		const subscriber = req.body.externalId
			? await subscriberService.upsert(
					workspaceId,
					req.body.externalId,
					req.body,
				)
			: await subscriberService.create({ ...req.body, workspaceId })

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

		const { page, limit } = parsePaginationQuery(req.query as Record<string, unknown>)
		const skip = (page - 1) * limit

		const [subscribers, total] = await subscriberService.search(
			workspaceId,
			skip,
			limit,
		)
		sendSuccess(req, res, { subscribers, total, page, limit }, 200, {
			page,
			limit,
			total,
			hasMore: page * limit < total,
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

		const subscriber = await subscriberService.findById(
			workspaceId,
			req.params.subscriberId as string,
		)
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

		const existing = await subscriberService.findById(
			workspaceId,
			req.params.subscriberId as string,
		)
		if (!existing) {
			throw new NotFoundError("Subscriber not found")
		}

		const subscriber = await subscriberService.update(
			workspaceId,
			req.params.subscriberId as string,
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

		const existing = await subscriberService.findById(
			workspaceId,
			req.params.subscriberId as string,
		)
		if (!existing) {
			throw new NotFoundError("Subscriber not found")
		}

		await subscriberService.delete(
			workspaceId,
			req.params.subscriberId as string,
		)
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
