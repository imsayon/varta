import type { NextFunction, Request, Response } from "express"
import { workspaceService } from "../workspaces/workspace.service.ts"
import { routingRuleCompiler } from "./routing-rule.compiler.ts"
import { routingRuleService } from "./routing-rule.service.ts"
import { requireWorkspaceCapability } from "@/common/auth/capability.ts"
import { sendSuccess } from "@/common/utils/response.ts"
import { parsePaginationQuery } from "@/common/utils/pagination.ts"

function workspaceIdOf(req: Request): string {
	const workspaceId = req.params.workspaceId
	if (typeof workspaceId !== "string" || !workspaceId) throw new Error("Workspace id is required")
	return workspaceId
}

export async function list(req: Request, res: Response, next: NextFunction) {
	try {
		const workspaceId = workspaceIdOf(req)
		await workspaceService.assertMembership(workspaceId, requireWorkspaceCapability(req).actorId)
		const { page, limit } = parsePaginationQuery(req.query as Record<string, unknown>)
		const rules = await routingRuleService.list(workspaceId, (page - 1) * limit, limit + 1)
		const hasMore = rules.length > limit
		sendSuccess(req, res, hasMore ? rules.slice(0, limit) : rules, 200, { page, limit, hasMore })
	} catch (error) {
		next(error)
	}
}

export async function create(req: Request, res: Response, next: NextFunction) {
	try {
		const workspaceId = workspaceIdOf(req)
		await workspaceService.assertAdmin(workspaceId, requireWorkspaceCapability(req).actorId)
		sendSuccess(req, res, await routingRuleService.create(workspaceId, req.body), 201)
	} catch (error) {
		next(error)
	}
}

export async function update(req: Request, res: Response, next: NextFunction) {
	try {
		const workspaceId = workspaceIdOf(req)
		await workspaceService.assertAdmin(workspaceId, requireWorkspaceCapability(req).actorId)
		sendSuccess(req, res, await routingRuleService.update(workspaceId, req.params.ruleId as string, req.body))
	} catch (error) {
		next(error)
	}
}

export async function remove(req: Request, res: Response, next: NextFunction) {
	try {
		const workspaceId = workspaceIdOf(req)
		await workspaceService.assertAdmin(workspaceId, requireWorkspaceCapability(req).actorId)
		await routingRuleService.remove(workspaceId, req.params.ruleId as string)
		sendSuccess(req, res, null)
	} catch (error) {
		next(error)
	}
}

export async function compile(req: Request, res: Response, next: NextFunction) {
	try {
		const workspaceId = workspaceIdOf(req)
		await workspaceService.assertAdmin(workspaceId, requireWorkspaceCapability(req).actorId)
		const result = await routingRuleCompiler.compile(workspaceId, req.body.naturalLanguage as string)
		sendSuccess(req, res, result)
	} catch (error) {
		next(error)
	}
}
