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

	if (err && typeof err === "object" && "type" in err) {
		if (err.type === "entity.too.large") {
			sendError(req, res, 413, "PAYLOAD_TOO_LARGE", "Request payload exceeds the allowed size")
			return
		}
		if (err.type === "entity.parse.failed") {
			sendError(req, res, 400, "INVALID_JSON", "Request body is not valid JSON")
			return
		}
		if (err.type === "encoding.unsupported" || err.type === "charset.unsupported") {
			sendError(req, res, 415, "UNSUPPORTED_ENCODING", "Request body encoding is not supported")
			return
		}
	}

	logger.error({ err, requestId }, "Unhandled error")
	sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Internal server error")
}
