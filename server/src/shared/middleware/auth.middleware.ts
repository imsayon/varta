import type { Request, Response, NextFunction } from "express"
import { errors } from "jose"
import { UnauthorizedError } from "@/shared/errors/app-error.ts"
import { verifyAccessToken } from "@/shared/utils/auth/jwt.ts"

// extracts and verifies the Bearer token from the Authorization header
// attaches decoded user context to req.user
export async function authenticate(
	req: Request,
	_res: Response,
	next: NextFunction,
) {
	try {
		const authHeader = req.headers.authorization

		if (!authHeader?.startsWith("Bearer ")) {
			throw new UnauthorizedError("Authentication required")
		}

		const token = authHeader.split(" ")[1]

		if (!token) {
			throw new UnauthorizedError("Invalid authorization header")
		}

		const { payload } = await verifyAccessToken(token)

		req.user = {
			id: payload.sub as string,
			sessionId: payload.sessionId as string,
			workspaceId: payload.workspaceId as string,
		}

		next()
	} catch (error) {
		if (error instanceof errors.JWTExpired) {
			next(new UnauthorizedError("Token expired"))
		} else {
			next(new UnauthorizedError("Invalid token"))
		}
	}
}
