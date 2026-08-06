import type { Request, Response, NextFunction } from "express"
import type { ZodType } from "zod"
import { sendError } from "../utils/response.ts"

type ValidationTarget = "body" | "params" | "query"

export function validate(schema: ZodType, target: ValidationTarget = "body") {
	return (req: Request, res: Response, next: NextFunction): void => {
		const result = schema.safeParse(req[target])

		if (!result.success) {
			sendError(
				req,
				res,
				400,
				"VALIDATION_ERROR",
				"Validation failed",
				result.error.flatten().fieldErrors,
			)
			return
		}
		;(req as unknown as Record<string, unknown>)[target] = result.data
		next()
	}
}
