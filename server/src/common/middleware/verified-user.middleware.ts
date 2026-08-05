import type { Request, Response, NextFunction } from "express"
import { prisma } from "@/infra/database/prisma.ts"

export async function requireVerifiedUser(
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> {
	if (!req.user || !req.user.id) {
		res.status(401).json({
			statusCode: 401,
			error: "Unauthorized",
			code: "UNAUTHORIZED",
			message: "Authentication required",
		})
		return
	}

	try {
		const user = await prisma.user.findUnique({
			where: { id: req.user.id },
			select: { emailVerified: true },
		})

		if (!user || !user.emailVerified) {
			res.status(403).json({
				statusCode: 403,
				error: "Forbidden",
				code: "EMAIL_NOT_VERIFIED",
				message: "Verified email address is required for this action",
			})
			return
		}

		next()
	} catch (error) {
		next(error)
	}
}
