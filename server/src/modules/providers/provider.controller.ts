import type { Request, Response, NextFunction } from "express"
import { providerService } from "./provider.service.ts"
import { workspaceService } from "../workspaces/workspace.service.ts"
import { Resend } from "resend"
import { decryptConfig } from "@/common/utils/crypto.util.ts"
import { requireWorkspaceCapability } from "@/common/auth/capability.ts"
import { sendSuccess } from "@/common/utils/response.ts"
import { NotFoundError, BadRequestError } from "@/common/errors/app-error.ts"

export const upsert = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = requireWorkspaceCapability(req).actorId
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
		sendSuccess(req, res, result)
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
		await workspaceService.assertAdmin(workspaceId, userId)

		const results = await providerService.listProviderConfigs(workspaceId)
		const data = results.map((result) => {
			const config = decryptConfig(
				result.config as Record<string, unknown>,
			)
			return {
				...result,
				config: Object.fromEntries(
					Object.entries(config).map(([key, value]) => [
						key,
						key.toLowerCase().includes("secret") ||
						key.toLowerCase().includes("key")
							? "********"
							: value,
					]),
				),
			}
		})
		sendSuccess(req, res, data, 200, { total: data.length, hasMore: false })
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
		const userId = requireWorkspaceCapability(req).actorId
		const workspaceId = req.params.workspaceId as string
		const channel = req.params.channel as string
		await workspaceService.assertAdmin(workspaceId, userId)

		const providerRecord = await providerService.getProviderConfig(
			workspaceId,
			channel,
		)
		if (!providerRecord?.config) {
			throw new NotFoundError("Provider config not found")
		}

		// Step 1: Test Resend connectivity by listing API keys
		if (providerRecord.provider === "resend") {
			const configData = decryptConfig(
				providerRecord.config as Record<string, unknown>,
			)
			const apiKey =
				typeof configData.apiKey === "string"
					? configData.apiKey
					: undefined
			if (!apiKey) {
				throw new BadRequestError("Missing Resend API key in config")
			}

			const resend = new Resend(apiKey)
			const { error } = await resend.apiKeys.list()
			if (error) {
				throw new BadRequestError("Test failed")
			}

			sendSuccess(req, res, null)
		} else {
			throw new BadRequestError(`Unsupported provider: ${providerRecord.provider}`)
		}
	} catch (err) {
		next(err)
	}
}
