import type { ErrorRequestHandler } from "express"
import { AppError, TooManyRequestsError, ValidationError } from "../errors/app-error.ts"
import { logger } from "@/infra/observability/logger.ts"

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
	if (res.headersSent) {
		_next(err)
		return
	}

	if (err instanceof ValidationError) {
		res.status(err.statusCode).json({
			statusCode: err.statusCode,
			error: err.message,
			code: err.code,
			details: err.details,
		})
		return
	}

	if (err instanceof AppError) {
		if (err instanceof TooManyRequestsError) {
			res.setHeader("Retry-After", String(err.retryAfterSeconds))
		}
		res.status(err.statusCode).json({
			statusCode: err.statusCode,
			error: err.message,
			code: err.code,
		})
		return
	}

	logger.error({ err }, "Unhandled error")

	res.status(500).json({
		statusCode: 500,
		error: "Internal server error",
		code: "INTERNAL_ERROR",
		...(process.env.NODE_ENV === "development" && err instanceof Error
			? { stack: err.stack }
			: {}),
	})
}
