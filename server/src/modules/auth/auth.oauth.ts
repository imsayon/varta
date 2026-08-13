import crypto from "node:crypto"
import type { Request, Response } from "express"
import { env } from "@/common/config/env.ts"
import {
	generateAccessToken,
	generateRefreshToken,
} from "@/common/utils/auth/jwt.ts"
import { setRefreshTokenCookie } from "@/common/utils/auth/cookies.ts"
import { hashToken } from "@/common/utils/auth/token-hash.ts"
import { authRepository } from "./auth.repository.ts"

export const authOauth = {
	async handleOAuthCallback(req: Request, res: Response, returnTo = "/analytics") {
		const user = req.oauthUser
		if (!user) {
			return res.redirect(
				`${env.CLIENT_URL}/login?error=oauth_failed`,
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
				`${env.CLIENT_URL}/login?error=no_workspace`,
			)
		}

		// Create access & refresh tokens
		const accessToken = await generateAccessToken({
			sub: user.id,
			sessionId: session.id,
			workspaceId: membership.workspaceId,
		})

		const refreshTokenId = crypto.randomUUID()
		const refreshToken = await generateRefreshToken({
			sub: user.id,
			sessionId: session.id,
			jti: refreshTokenId,
		})

		await authRepository.createRefreshToken({
			id: refreshTokenId,
			sessionId: session.id,
			tokenHash: hashToken(refreshToken),
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
		})

		// Set cookie using shared utility for consistent SameSite behavior
		setRefreshTokenCookie(res, refreshToken)

		const callback = new URL("/auth/callback", env.CLIENT_URL)
		callback.searchParams.set("returnTo", returnTo)
		res.redirect(303, callback.toString())
	},
}
