import type { ErrorRequestHandler } from "express"
import { AppError, TooManyRequestsError, ValidationError } from "../errors/app-error.ts"
import { logger } from "@/infra/observability/logger.ts"
import { sendError } from "../utils/response.ts"

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
	if (res.headersSent) {
		_next(err)
		return
	}
	const requestId = req.requestId || req.id || (res.getHeader("x-request-id") as string)

	if (err instanceof ValidationError) {
		sendError(req, res, err.statusCode, err.code || "VALIDATION_ERROR", err.message, err.details)
		return
	}

	if (err instanceof AppError) {
		if (err instanceof TooManyRequestsError) {
			res.setHeader("Retry-After", String(err.retryAfterSeconds))
		}
		sendError(req, res, err.statusCode, err.code || "APP_ERROR", err.message)
		return
	}

	logger.error({ err, requestId }, "Unhandled error")
	sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Internal server error")
}
