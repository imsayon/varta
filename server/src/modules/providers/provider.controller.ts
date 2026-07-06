import type { Request, Response, NextFunction } from "express"
import { providerService } from "./provider.service.ts"
import { workspaceService } from "../workspaces/workspace.service.ts"
import { Resend } from "resend"
import { decryptConfig } from "@/common/crypto.util.ts"

export const upsert = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = req.user!.id
		const workspaceId = req.params.workspaceId as string

		// Step 1: Only admins can configure providers
		await workspaceService.assertAdmin(workspaceId, userId)

		const { provider, config, isActive } = req.body
		const channel = req.params.channel as string

		const result = await providerService.updateConfig(
			workspaceId,
			channel,
			provider,
			config,
			isActive ?? true,
		)
		res.status(200).json({ success: true, data: result })
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
		await workspaceService.assertAdmin(workspaceId, userId)

		// Phase 1: only email channel supported
		const result = await providerService.getProviderConfig(
			workspaceId,
			"email",
		)
		const data = result
			? {
					...result,
					config: decryptConfig(result.config as Record<string, unknown>),
				}
			: null
		res.status(200).json({ success: true, data })
	} catch (err) {
		next(err)
	}
}

export const testConnection = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = req.user!.id
		const workspaceId = req.params.workspaceId as string
		const channel = req.params.channel as string
		await workspaceService.assertAdmin(workspaceId, userId)

		const providerRecord = await providerService.getProviderConfig(
			workspaceId,
			channel,
		)
		if (!providerRecord?.config) {
			res.status(404).json({
				success: false,
				message: "Provider config not found",
			})
			return
		}

		// Step 1: Test Resend connectivity by listing API keys
		if (providerRecord.provider === "resend") {
			const configData = decryptConfig(
				providerRecord.config as Record<string, unknown>,
			)
			const apiKey = typeof configData.apiKey === "string" ? configData.apiKey : undefined
			if (!apiKey) {
				res.status(400).json({
					success: false,
					message: "Missing Resend API key in config",
				})
				return
			}

			const resend = new Resend(apiKey)
			const { error } = await resend.apiKeys.list()
			if (error) {
				res.status(400).json({
					success: false,
					message: "Test failed",
					error,
				})
				return
			}

			res.status(200).json({
				success: true,
				message: "Connection successful",
			})
		} else {
			res.status(400).json({
				success: false,
				message: `Unsupported provider: ${providerRecord.provider}`,
			})
		}
	} catch (err) {
		next(err)
	}
}
