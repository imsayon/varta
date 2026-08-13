import type { Request, Response, NextFunction } from "express"
import { randomUUID } from "node:crypto"
import { withLogContext } from "@/infra/observability/log-context.ts"

const EXTERNAL_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

function validExternalId(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined
	const candidate = value.trim()
	return EXTERNAL_ID_PATTERN.test(candidate) ? candidate : undefined
}

declare global {
	namespace Express {
		interface Request {
			id?: string
			requestId?: string
			correlationId?: string
		}
	}
}

export function requestIdMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const existingId = validExternalId(req.headers["x-request-id"])
	const requestId =
		existingId
			? existingId
			: `req_${randomUUID().replace(/-/g, "")}`
	const correlationId = validExternalId(req.headers["x-correlation-id"]) ?? requestId

	req.id = requestId
	req.requestId = requestId
	req.correlationId = correlationId
	res.setHeader("x-request-id", requestId)
	res.setHeader("x-correlation-id", correlationId)

	withLogContext({ requestId, correlationId }, next)
}
