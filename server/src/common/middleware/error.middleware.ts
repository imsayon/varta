import type { ErrorRequestHandler } from "express"
import { AppError, TooManyRequestsError, ValidationError } from "../errors/app-error.ts"
import { logger } from "@/infra/observability/logger.ts"

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
	if (res.headersSent) {
		_next(err)
		return
	}

	const requestId = req.requestId || req.id || (res.getHeader("x-request-id") as string)

	if (err instanceof ValidationError) {
		res.status(err.statusCode).json({
			success: false,
			error: {
				code: err.code || "VALIDATION_ERROR",
				message: err.message,
				details: err.details,
			},
			meta: {
				requestId,
			},
		})
		return
	}

	if (err instanceof AppError) {
		if (err instanceof TooManyRequestsError) {
			res.setHeader("Retry-After", String(err.retryAfterSeconds))
		}
		res.status(err.statusCode).json({
			success: false,
			error: {
				code: err.code || "APP_ERROR",
				message: err.message,
			},
			meta: {
				requestId,
			},
		})
		return
	}

	logger.error({ err, requestId }, "Unhandled error")

	res.status(500).json({
		success: false,
		error: {
			code: "INTERNAL_SERVER_ERROR",
			message: "Internal server error",
			...(process.env.NODE_ENV === "development" && err instanceof Error
				? { stack: err.stack }
				: {}),
		},
		meta: {
			requestId,
		},
	})
}
