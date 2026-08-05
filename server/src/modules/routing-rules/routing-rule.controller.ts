import type { NextFunction, Request, Response } from "express"
import { workspaceService } from "../workspaces/workspace.service.ts"
import { routingRuleCompiler } from "./routing-rule.compiler.ts"
import { routingRuleService } from "./routing-rule.service.ts"

function workspaceIdOf(req: Request): string {
	const workspaceId = req.params.workspaceId
	if (typeof workspaceId !== "string" || !workspaceId) throw new Error("Workspace id is required")
	return workspaceId
}

export async function list(req: Request, res: Response, next: NextFunction) {
	try {
		const workspaceId = workspaceIdOf(req)
		await workspaceService.assertMembership(workspaceId, req.user!.id)
		res.status(200).json({ success: true, data: await routingRuleService.list(workspaceId) })
	} catch (error) {
		next(error)
	}
}

export async function create(req: Request, res: Response, next: NextFunction) {
	try {
		const workspaceId = workspaceIdOf(req)
		await workspaceService.assertAdmin(workspaceId, req.user!.id)
		res.status(201).json({ success: true, data: await routingRuleService.create(workspaceId, req.body) })
	} catch (error) {
		next(error)
	}
}

export async function update(req: Request, res: Response, next: NextFunction) {
	try {
		const workspaceId = workspaceIdOf(req)
		await workspaceService.assertAdmin(workspaceId, req.user!.id)
		res.status(200).json({
			success: true,
			data: await routingRuleService.update(workspaceId, req.params.ruleId as string, req.body),
		})
	} catch (error) {
		next(error)
	}
}

export async function remove(req: Request, res: Response, next: NextFunction) {
	try {
		const workspaceId = workspaceIdOf(req)
		await workspaceService.assertAdmin(workspaceId, req.user!.id)
		await routingRuleService.remove(workspaceId, req.params.ruleId as string)
		res.status(204).send()
	} catch (error) {
		next(error)
	}
}

export async function compile(req: Request, res: Response, next: NextFunction) {
	try {
		const workspaceId = workspaceIdOf(req)
		await workspaceService.assertAdmin(workspaceId, req.user!.id)
		const result = await routingRuleCompiler.compile(workspaceId, req.body.naturalLanguage as string)
		res.status(200).json({ success: true, data: result })
	} catch (error) {
		next(error)
	}
}
