import type { Request, Response, NextFunction } from "express"
import { templateService } from "./template.service.ts"
import { workspaceService } from "../workspaces/workspace.service.ts"
import Handlebars from "handlebars"
import DOMPurify from "isomorphic-dompurify"

export const create = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = req.user!.id
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const template = await templateService.create({
			...req.body,
			workspaceId,
		})
		res.status(201).json({ success: true, data: template })
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
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const page = Math.max(1, parseInt(req.query.page as string) || 1)
		const limit = Math.min(
			100,
			Math.max(1, parseInt(req.query.limit as string) || 20),
		)
		const skip = (page - 1) * limit

		const [templates, total] = await templateService.search(
			workspaceId,
			skip,
			limit,
		)
		res.status(200).json({
			success: true,
			data: { templates, total, page, limit },
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
		const userId = req.user!.id
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const template = await templateService.findById(
			workspaceId,
			req.params.templateId as string,
		)
		if (!template) {
			res.status(404).json({
				success: false,
				message: "Template not found",
			})
			return
		}

		res.status(200).json({ success: true, data: template })
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
		await workspaceService.assertMembership(workspaceId, userId)

		const existing = await templateService.findById(
			workspaceId,
			req.params.templateId as string,
		)
		if (!existing) {
			res.status(404).json({
				success: false,
				message: "Template not found",
			})
			return
		}

		const template = await templateService.update(
			workspaceId,
			req.params.templateId as string,
			req.body,
		)
		res.status(200).json({ success: true, data: template })
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
		await workspaceService.assertMembership(workspaceId, userId)

		const existing = await templateService.findById(
			workspaceId,
			req.params.templateId as string,
		)
		if (!existing) {
			res.status(404).json({
				success: false,
				message: "Template not found",
			})
			return
		}

		await templateService.delete(
			workspaceId,
			req.params.templateId as string,
		)
		res.status(200).json({ success: true, message: "Template deleted" })
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
		const userId = req.user!.id
		const workspaceId = req.params.workspaceId as string
		await workspaceService.assertMembership(workspaceId, userId)

		const { content, payload } = req.body

		// Step 1: Compile Handlebars template and render with payload
		const render = Handlebars.compile(content, { strict: false })
		const rawHtml = render(payload)

		// Step 2: Sanitize to prevent XSS in rendered output
		const sanitizedHtml = DOMPurify.sanitize(rawHtml)

		res.status(200).json({ success: true, data: { html: sanitizedHtml } })
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "Template preview failed"
		res.status(400).json({
			success: false,
			message: "Failed to preview template",
			error: message,
		})
	}
}
