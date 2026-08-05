import type { Request, Response, NextFunction } from "express"
import { workspaceService } from "../workspaces/workspace.service.ts"
import { analyticsService } from "./analytics.service.ts"
import type { AnalyticsQuery } from "./analytics.schema.ts"

async function context(req: Request): Promise<{ workspaceId: string; query: AnalyticsQuery }> {
	const workspaceId = req.params.workspaceId as string
	await workspaceService.assertMembership(workspaceId, req.user!.id)
	return { workspaceId, query: req.query as unknown as AnalyticsQuery }
}

export const overview = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const c = await context(req)
		res.json({ success: true, data: await analyticsService.overview(c.workspaceId, c.query) })
	} catch (error) {
		next(error)
	}
}

export const deliveryTimeline = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const c = await context(req)
		res.json({ success: true, data: await analyticsService.deliveryTimeline(c.workspaceId, c.query) })
	} catch (error) {
		next(error)
	}
}

export const channelBreakdown = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const c = await context(req)
		res.json({ success: true, data: await analyticsService.channelBreakdown(c.workspaceId, c.query) })
	} catch (error) {
		next(error)
	}
}

export const topTemplates = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const c = await context(req)
		res.json({ success: true, data: await analyticsService.topTemplates(c.workspaceId, c.query) })
	} catch (error) {
		next(error)
	}
}
