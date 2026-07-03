import type { Request, Response } from "express"
import {
	generateAccessToken,
	generateRefreshToken,
} from "@/common/utils/auth/jwt.ts"
import { hashPassword } from "@/common/utils/auth/password.ts"
import { authRepository } from "./auth.repository.ts"

export const authOauth = {
	async handleOAuthCallback(req: Request, res: Response) {
		const user = req.user as any
		if (!user) {
			return res.redirect(
				`${process.env.CLIENT_URL}/login?error=oauth_failed`,
			)
		}

		const userAgent = req.headers["user-agent"] as string | undefined
		const ipAddress = req.ip as string | undefined

		const session = await authRepository.createSession({
			userId: user.id,
			...(userAgent !== undefined && { userAgent }),
			...(ipAddress !== undefined && { ipAddress }),
		})

		const membership = await authRepository.findPrimaryWorkspaceForUser(
			user.id,
		)
		if (!membership) {
			return res.redirect(
				`${process.env.CLIENT_URL}/login?error=no_workspace`,
			)
		}

		// Create access & refresh tokens
		const accessToken = await generateAccessToken({
			sub: user.id,
			sessionId: session.id,
			workspaceId: membership.workspaceId,
		})

		const refreshToken = await generateRefreshToken({
			sub: user.id,
			sessionId: session.id,
		})

		await authRepository.createRefreshToken({
			sessionId: session.id,
			tokenHash: await hashPassword(refreshToken),
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
		})

		// Set cookie
		res.cookie("refreshToken", refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			path: "/",
			maxAge: 30 * 24 * 60 * 60 * 1000,
		})

		// We could pass the access token in a short-lived cookie, or the client can fetch it via /refresh
		// Since our client relies on /refresh, we just redirect.
		res.redirect(`${process.env.CLIENT_URL}/dashboard`)
	},
}
