import type { Request, Response, NextFunction } from "express"
import { prisma } from "@/infra/database/prisma.ts"
import { requireCapability } from "@/common/auth/capability.ts"

export async function requireVerifiedUser(
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> {
	try {
		const actorId = requireCapability(req).principal.actorId
		if (!actorId) throw new Error("Capability has no actor")
		const user = await prisma.user.findUnique({
			where: { id: actorId },
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
