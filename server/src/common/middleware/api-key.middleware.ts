import type { Request, Response, NextFunction } from "express"
import { apiKeyService } from "@/modules/api-keys/api-key.service.ts"
import { UnauthorizedError } from "@/common/errors/app-error.ts"
import { workspaceContextFor, type ApiKeyPrincipal } from "@/common/auth/principal.ts"

export async function apiKeyAuth(
	req: Request,
	_res: Response,
	next: NextFunction,
) {
	try {
		const apiKey = req.headers["x-api-key"]

		if (typeof apiKey !== "string" || !apiKey.startsWith("vt_live_")) {
			throw new UnauthorizedError("Valid API key required")
		}

		const keyRecord = await apiKeyService.verify(apiKey)
		if (!keyRecord) {
			throw new UnauthorizedError("Invalid or revoked API key")
		}

		const scopes = Array.isArray(keyRecord.permissions)
			? keyRecord.permissions.filter((scope): scope is string => typeof scope === "string")
			: []
		const principal: ApiKeyPrincipal = {
			kind: "api_key",
			actorId: keyRecord.id,
			workspaceId: keyRecord.workspaceId,
			keyId: keyRecord.id,
			scopes,
			verification: "not_applicable",
		}
		req.capability = {
			principal,
			workspace: workspaceContextFor(principal, "API_KEY"),
		}

		next()
	} catch (err) {
		next(err)
	}
}

export function requireApiKeyScope(requiredScope: string) {
	return (req: Request, res: Response, next: NextFunction) => {
		if (req.capability?.principal.kind !== "api_key") {
			return next(
				new UnauthorizedError("API key authentication required"),
			)
		}
		const scopes = req.capability.principal.scopes
		if (!scopes.includes(requiredScope) && !scopes.includes("*")) {
			res.status(403).json({
				statusCode: 403,
				error: "Forbidden",
				code: "INSUFFICIENT_PERMISSIONS",
				message: `API key lacks required permission scope '${requiredScope}'`,
			})
			return
			}
		next()
	}
}
