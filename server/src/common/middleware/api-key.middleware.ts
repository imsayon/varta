import type { Request, Response, NextFunction } from "express"
import { apiKeyService } from "@/modules/api-keys/api-key.service.ts"
import { UnauthorizedError } from "@/common/errors/app-error.ts"

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
		}

		next()
	} catch (err) {
		next(err)
	}
}
