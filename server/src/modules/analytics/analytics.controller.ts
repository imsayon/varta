import type { Request, Response, NextFunction } from "express"
import type { AnalyticsQuery } from "./analytics.schema.ts"
import { workspaceService } from "../workspaces/workspace.service.ts"
import { analyticsService } from "./analytics.service.ts"
import { requireWorkspaceCapability } from "@/common/auth/capability.ts"
import { sendSuccess } from "@/common/utils/response.ts"

async function context(
	req: Request,
): Promise<{ workspaceId: string; query: AnalyticsQuery }> {
	const workspaceId = req.params.workspaceId as string
	await workspaceService.assertMembership(
		workspaceId,
		requireWorkspaceCapability(req).actorId,
	)
	return { workspaceId, query: req.query as unknown as AnalyticsQuery }
}

export const overview = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const c = await context(req)
		sendSuccess(
			req,
			res,
			await analyticsService.overview(c.workspaceId, c.query),
		)
	} catch (error) {
		next(error)
	}
}

export const deliveryTimeline = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const c = await context(req)
		sendSuccess(
			req,
			res,
			await analyticsService.deliveryTimeline(c.workspaceId, c.query),
		)
	} catch (error) {
		next(error)
	}
}

export const channelBreakdown = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const c = await context(req)
		sendSuccess(
			req,
			res,
			await analyticsService.channelBreakdown(c.workspaceId, c.query),
		)
	} catch (error) {
		next(error)
	}
}

export const topTemplates = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const c = await context(req)
		sendSuccess(
			req,
			res,
			await analyticsService.topTemplates(c.workspaceId, c.query),
		)
	} catch (error) {
		next(error)
	}
}
