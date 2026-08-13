import type { Request, Response, NextFunction } from "express"
import { env } from "@/common/config/env.ts"
import { authService } from "./auth.service.ts"
import { authRepository } from "./auth.repository.ts"
import {
	setRefreshTokenCookie,
	clearRefreshTokenCookie,
} from "@/common/utils/auth/cookies.ts"
import { verifyRefreshToken } from "@/common/utils/auth/jwt.ts"
import { requireCapability } from "@/common/auth/capability.ts"
import { sendSuccess } from "@/common/utils/response.ts"
import { UnauthorizedError, BadRequestError, NotFoundError } from "@/common/errors/app-error.ts"

export const authController = {
	async register(req: Request, res: Response) {
		const result = await authService.register(req.body)
		sendSuccess(req, res, result, 201)
	},

	async login(req: Request, res: Response) {
		const userAgent = req.headers["user-agent"] as string | undefined
		const ipAddress = req.ip

		const result = await authService.login({
			...req.body,
			userAgent,
			ipAddress,
		})

		setRefreshTokenCookie(res, result.refreshToken)

		sendSuccess(req, res, {
			user: result.publicUser,
			accessToken: result.accessToken,
		})
	},

	async refresh(req: Request, res: Response) {
		const refreshToken = req.cookies.refreshToken
		if (!refreshToken) {
			throw new UnauthorizedError("No refresh token")
		}

		try {
			const result = await authService.refresh(refreshToken)
			setRefreshTokenCookie(res, result.refreshToken)
			sendSuccess(req, res, { accessToken: result.accessToken })
		} catch (error) {
			clearRefreshTokenCookie(res)
			if (error instanceof UnauthorizedError) throw error
			throw new UnauthorizedError("Invalid refresh token")
		}
	},

	async logout(req: Request, res: Response) {
		await authService.logout(req.cookies.refreshToken)

		clearRefreshTokenCookie(res)

		sendSuccess(req, res, null)
	},

	async logoutAll(req: Request, res: Response) {
		if (!req.cookies.refreshToken) {
			throw new UnauthorizedError("No refresh token")
		}

		try {
			const { payload } = await verifyRefreshToken(
				req.cookies.refreshToken,
			)
			await authService.logoutAll(payload.sub as string)

			clearRefreshTokenCookie(res)
			sendSuccess(req, res, null)
		} catch (error) {
			clearRefreshTokenCookie(res)
			if (error instanceof UnauthorizedError) throw error
			throw new UnauthorizedError("Invalid refresh token")
		}
	},

	async verifyEmail(req: Request, res: Response) {
		const token = (req.query.token || req.body?.token) as string
		if (!token) {
			throw new BadRequestError("Token is required")
		}
		await authService.verifyEmail(token)
		if (req.headers.accept?.includes("application/json") || req.body?.token) {
			sendSuccess(req, res, null)
		} else {
			res.redirect(`${env.CLIENT_URL}/login?verified=true`)
		}
	},

	async resendVerification(req: Request, res: Response) {
		await authService.resendVerification(req.body.email)
		sendSuccess(req, res, null)
	},

	async forgotPassword(req: Request, res: Response) {
		await authService.forgotPassword(req.body.email)
		sendSuccess(req, res, null)
	},

	async resetPassword(req: Request, res: Response) {
		const pass = req.body.newPassword || req.body.password
		await authService.resetPassword(req.body.token, pass)
		sendSuccess(req, res, null)
	},

	async getSessions(req: Request, res: Response) {
		const sessions = await authService.getSessions(requireCapability(req).principal.actorId as string)
		sendSuccess(req, res, sessions)
	},

	async revokeSession(req: Request, res: Response) {
		await authService.revokeSession(
			requireCapability(req).principal.actorId as string,
			req.params.id as string,
		)
		sendSuccess(req, res, null)
	},

	async me(req: Request, res: Response) {
		const user = await authRepository.findUserById(requireCapability(req).principal.actorId as string)
		if (!user) {
			throw new NotFoundError("User not found")
		}

		sendSuccess(req, res, {
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			createdAt: user.createdAt,
		})
	},
}
