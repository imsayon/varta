import type { Request, Response, NextFunction } from "express"
import { env } from "@/shared/config/env.ts"
import { authService } from "./auth.service.ts"
import { authRepository } from "./auth.repository.ts"
import { setRefreshTokenCookie, clearRefreshTokenCookie } from "@/shared/utils/auth/cookies.ts"
import { verifyRefreshToken } from "@/shared/utils/auth/jwt.ts"

export const authController = {
	async register(req: Request, res: Response) {
		const result = await authService.register(req.body)
		res.status(201).json({
			success: true,
			data: result,
		})
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

		res.status(200).json({
			success: true,
			data: {
				user: result.publicUser,
				accessToken: result.accessToken,
			},
		})
	},

	async refresh(req: Request, res: Response) {
		const refreshToken = req.cookies.refreshToken
		if (!refreshToken) {
			res.status(401).json({ success: false, message: "No refresh token" })
			return
		}

		try {
			const result = await authService.refresh(refreshToken)
			setRefreshTokenCookie(res, result.refreshToken)
			res.status(200).json({
				success: true,
				data: { accessToken: result.accessToken },
			})
		} catch (error) {
			clearRefreshTokenCookie(res)
			res.status(401).json({ success: false, message: "Invalid refresh token" })
		}
	},

	async logout(req: Request, res: Response) {
		await authService.logout(req.cookies.refreshToken)

		clearRefreshTokenCookie(res)

		res.status(200).json({ success: true })
	},

	async logoutAll(req: Request, res: Response) {
		if (!req.cookies.refreshToken) {
			res.status(401).json({ success: false, message: "No refresh token" })
			return
		}
		
		try {
			const { payload } = await verifyRefreshToken(req.cookies.refreshToken)
			await authService.logoutAll(payload.sub as string)

			clearRefreshTokenCookie(res)
			res.status(200).json({ success: true, message: "Logged out of all devices" })
		} catch (error) {
			clearRefreshTokenCookie(res)
			res.status(401).json({ success: false, message: "Invalid refresh token" })
		}
	},

	async verifyEmail(req: Request, res: Response) {
		const token = req.query.token as string
		await authService.verifyEmail(token)
		res.redirect(`${env.CLIENT_URL}/login?verified=true`)
	},

	async resendVerification(req: Request, res: Response) {
		await authService.resendVerification(req.body.email)
		res.status(200).json({
			success: true,
			message: "If the email is not verified, a new link was sent",
		})
	},

	async forgotPassword(req: Request, res: Response) {
		await authService.forgotPassword(req.body.email)
		res.status(200).json({
			success: true,
			message: "If an account with that email exists, we sent a password reset link",
		})
	},

	async resetPassword(req: Request, res: Response) {
		await authService.resetPassword(req.body.token, req.body.password)
		res.status(200).json({
			success: true,
			message: "Password has been reset successfully",
		})
	},

	async getSessions(req: Request, res: Response) {
		const sessions = await authService.getSessions((req.user as any).id)
		res.status(200).json({
			success: true,
			data: sessions,
		})
	},

	async revokeSession(req: Request, res: Response) {
		await authService.revokeSession((req.user as any).id, req.params.id as string)
		res.status(200).json({
			success: true,
			message: "Session revoked successfully",
		})
	},

	async me(req: Request, res: Response) {
		const user = await authRepository.findUserById((req.user as any).id)
		if (!user) {
			res.status(404).json({ success: false, message: "User not found" })
			return
		}
		
		res.status(200).json({
			success: true,
			data: {
				id: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.emailVerified,
				createdAt: user.createdAt,
			},
		})
	}
}
