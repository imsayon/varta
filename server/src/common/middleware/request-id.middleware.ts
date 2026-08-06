import type { Request, Response, NextFunction } from "express"
import { randomUUID } from "node:crypto"

declare global {
	namespace Express {
		interface Request {
			id?: string
			requestId?: string
		}
	}
}

export function requestIdMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const existingId = req.headers["x-request-id"] as string | undefined
	const requestId =
		existingId && existingId.trim().length > 0
			? existingId.trim()
			: `req_${randomUUID().replace(/-/g, "")}`

	req.id = requestId
	req.requestId = requestId
	res.setHeader("x-request-id", requestId)

	next()
}
