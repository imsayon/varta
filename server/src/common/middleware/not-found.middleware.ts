import type { Request, Response } from "express"
import { sendError } from "../utils/response.ts"

export const notFoundHandler = (req: Request, res: Response): void => {
	sendError(req, res, 404, "NOT_FOUND", "Route not found")
}
