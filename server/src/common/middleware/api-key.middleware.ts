import type { Request, Response, NextFunction } from "express"
import { apiKeyService } from "@/modules/api-keys/api-key.service.ts"
import { UnauthorizedError } from "@/common/errors/app-error.ts"

declare global {
	namespace Express {
		interface Request {
			apiKey?: {
				id: string
				workspaceId: string
				permissions?: string[]
			}
		}
	}
}

export async function apiKeyAuth(
	req: Request,
	_res: Response,
	next: NextFunction,
) {
	try {
		const apiKey =
			(req.headers["x-api-key"] as string) ||
			req.headers.authorization?.replace("Bearer ", "")

		if (!apiKey || !apiKey.startsWith("vt_live_")) {
			throw new UnauthorizedError("Valid API key required")
		}

		const keyRecord = await apiKeyService.verify(apiKey)
		if (!keyRecord) {
			throw new UnauthorizedError("Invalid or revoked API key")
		}

		req.apiKey = {
			id: keyRecord.id,
			workspaceId: keyRecord.workspaceId,
			permissions: (keyRecord.permissions as string[]) || [],
		}

		next()
	} catch (err) {
		next(err)
	}
}

export function requireApiKeyScope(requiredScope: string) {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.apiKey) {
			return next(
				new UnauthorizedError("API key authentication required"),
			)
		}
		if (req.apiKey.permissions && req.apiKey.permissions.length > 0) {
			if (
				!req.apiKey.permissions.includes(requiredScope) &&
				!req.apiKey.permissions.includes("*")
			) {
				res.status(403).json({
					statusCode: 403,
					error: "Forbidden",
					code: "INSUFFICIENT_PERMISSIONS",
					message: `API key lacks required permission scope '${requiredScope}'`,
				})
				return
			}
		}
		next()
	}
}
