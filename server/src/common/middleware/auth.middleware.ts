import type { Request, Response, NextFunction } from "express"
import { errors } from "jose"
import { UnauthorizedError } from "@/common/errors/app-error.ts"
import { verifyAccessToken } from "@/common/utils/auth/jwt.ts"
import { prisma } from "@/infra/database/prisma.ts"
import {
	type BrowserJwtPrincipal,
	workspaceContextFor,
} from "@/common/auth/principal.ts"

// Extracts and verifies the browser JWT and attaches a typed capability.
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
		if (
			typeof payload.sub !== "string" ||
			typeof payload.sessionId !== "string" ||
			typeof payload.workspaceId !== "string" ||
			payload.type !== "access"
		) {
			throw new UnauthorizedError("Invalid token claims")
		}

		const [user, membership] = await Promise.all([
			prisma.user.findUnique({
				where: { id: payload.sub },
				select: { emailVerified: true },
			}),
			prisma.workspaceMember.findUnique({
				where: {
					userId_workspaceId: {
						userId: payload.sub,
						workspaceId: payload.workspaceId,
					},
				},
				select: { role: true },
			}),
		])
		if (!user || !membership) throw new UnauthorizedError("Session is not a workspace member")

		const principal: BrowserJwtPrincipal = {
			kind: "browser_jwt",
			actorId: payload.sub,
			workspaceId: payload.workspaceId,
			sessionId: payload.sessionId,
			role: membership.role,
			scopes: [],
			verification: user.emailVerified ? "verified" : "unverified",
		}
		req.capability = {
			principal,
			workspace: workspaceContextFor(principal, membership.role),
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

export async function authenticateAny(
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> {
	if (typeof req.headers["x-api-key"] === "string") {
		await import("./api-key.middleware.ts").then(({ apiKeyAuth }) =>
			apiKeyAuth(req, res, next),
		)
		return
	}
	await authenticate(req, res, next)
}

export function captureOAuthUser(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	const user = (req as Request & { user?: unknown }).user
	if (!user || typeof user !== "object" || !("id" in user) || typeof user.id !== "string") {
		next(new UnauthorizedError("OAuth identity missing"))
		return
	}
	req.oauthUser = { id: user.id }
	next()
}
