import type { Request, Response, NextFunction } from "express"
import type { ZodType } from "zod"

type ValidationTarget = "body" | "params" | "query"

export function validate(schema: ZodType, target: ValidationTarget = "body") {
	return (req: Request, res: Response, next: NextFunction): void => {
		const result = schema.safeParse(req[target])

		if (!result.success) {
			res.status(400).json({
				statusCode: 400,
				error: "Validation failed",
				code: "VALIDATION_ERROR",
				details: result.error.flatten().fieldErrors,
			})
			return
		}
		;(req as any)[target] = result.data
		next()
	}
}
