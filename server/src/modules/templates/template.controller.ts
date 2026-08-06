import type { Request, Response, NextFunction } from "express"
import { templateService } from "./template.service.ts"
import { workspaceService } from "../workspaces/workspace.service.ts"
import Handlebars from "handlebars"
import DOMPurify from "isomorphic-dompurify"
import { requireWorkspaceCapability } from "@/common/auth/capability.ts"
import { sendSuccess } from "@/common/utils/response.ts"
import { NotFoundError, BadRequestError } from "@/common/errors/app-error.ts"
import { parsePaginationQuery } from "@/common/utils/pagination.ts"

export const create = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = requireWorkspaceCapability(req).actorId
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const template = await templateService.create({
			...req.body,
			workspaceId,
		})
		sendSuccess(req, res, template, 201)
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
		const skip = (page - 1) * limit

		const [templates, total] = await templateService.search(
			workspaceId,
			skip,
			limit,
		)
		sendSuccess(req, res, { templates, total, page, limit }, 200, {
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
		const userId = requireWorkspaceCapability(req).actorId
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const template = await templateService.findById(
			workspaceId,
			req.params.templateId as string,
		)
		if (!template) {
			throw new NotFoundError("Template not found")
		}

		sendSuccess(req, res, template)
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
		const userId = requireWorkspaceCapability(req).actorId
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const existing = await templateService.findById(
			workspaceId,
			req.params.templateId as string,
		)
		if (!existing) {
			throw new NotFoundError("Template not found")
		}

		const template = await templateService.update(
			workspaceId,
			req.params.templateId as string,
			req.body,
		)
		sendSuccess(req, res, template)
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
		await workspaceService.assertMembership(workspaceId, userId)

		const existing = await templateService.findById(
			workspaceId,
			req.params.templateId as string,
		)
		if (!existing) {
			throw new NotFoundError("Template not found")
		}

		await templateService.delete(
			workspaceId,
			req.params.templateId as string,
		)
		sendSuccess(req, res, null)
	} catch (err) {
		next(err)
	}
}

export const preview = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = requireWorkspaceCapability(req).actorId
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const { content, payload } = req.body

		// Step 1: Compile Handlebars template and render with payload
		const render = Handlebars.compile(content, { strict: false })
		const rawHtml = render(payload)

		// Step 2: Sanitize to prevent XSS in rendered output
		const sanitizedHtml = DOMPurify.sanitize(rawHtml)

		sendSuccess(req, res, { html: sanitizedHtml })
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "Template preview failed"
		next(new BadRequestError(message))
	}
}
