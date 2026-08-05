import crypto from "node:crypto"
import slugify from "slugify"
import { authRepository } from "./auth.repository.ts"
import { hashPassword, verifyPassword } from "@/common/utils/auth/password.ts"
import { hashToken, verifyToken } from "@/common/utils/auth/token-hash.ts"
import { env } from "@/common/config/env.ts"
import { resend } from "@/common/providers/resend.ts"
import { buildVerificationEmail } from "@/common/templates/verification-email.ts"
import { buildResetPasswordEmail } from "@/common/templates/reset-password-email.ts"
import {
	generateAccessToken,
	generateRefreshToken,
	type RefreshTokenPayload,
	verifyRefreshToken,
} from "@/common/utils/auth/jwt.ts"
import {
	generateEmailToken,
	hashEmailToken,
} from "@/common/utils/auth/email-token.ts"

import {
	ConflictError,
	UnauthorizedError,
	BadRequestError,
} from "@/common/errors/app-error.ts"

import type { RegisterInput, LoginInput } from "./auth.schema.ts"

const THIRTY_DAYS_IN_MS = 1000 * 60 * 60 * 24 * 30
const ONE_HOUR_IN_MS = 1000 * 60 * 60
const ONE_DAY_IN_MS = 1000 * 60 * 60 * 24

// strip internal fields before sending user data to the client
function buildPublicUser(user: {
	id: string
	name: string | null
	email: string
	emailVerified: boolean
	createdAt: Date
}) {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		emailVerified: user.emailVerified,
		createdAt: user.createdAt,
	}
}

export const authService = {
	// Register
	async register(data: RegisterInput) {
		const { name, email, password } = data

		const existingUser = await authRepository.findUserByEmail(email)
		if (existingUser) {
			throw new ConflictError("User with this email already exists")
		}

		const passwordHash = await hashPassword(password)

		const user = await authRepository.createUser({
			name,
			email,
			passwordHash,
		})

		// every user gets a default workspace on signup
		const workspaceName = `${name}'s Workspace`
		const baseSlug = slugify(workspaceName, {
			lower: true,
			strict: true,
			trim: true,
		})
		const randomSuffix = crypto.randomBytes(4).toString("hex")

		const workspace = await authRepository.createWorkspace({
			name: workspaceName,
			slug: `${baseSlug}-${randomSuffix}`,
		})

		await authRepository.createWorkspaceMember({
			userId: user.id,
			workspaceId: workspace.id,
		})

		// generate email verification token
		const rawToken = generateEmailToken()
		await authRepository.createEmailVerification({
			userId: user.id,
			tokenHash: hashEmailToken(rawToken),
			expiresAt: new Date(
				Date.now() + env.EMAIL_VERIFY_TOKEN_TTL_HOURS * ONE_HOUR_IN_MS,
			),
		})

		const verificationUrl = `${env.CLIENT_URL}/verify-email?token=${rawToken}`

		if (resend) {
			await resend.emails
				.send({
					from: env.EMAIL_FROM,
					to: email,
					subject: "Verify your email address - Varta",
					html: buildVerificationEmail(name, verificationUrl),
				})
				.catch((err) =>
					console.error("Failed to send verification email:", err),
				)
		} else {
			console.log(
				`[DEV] Email verification link for ${email}: ${verificationUrl}`,
			)
		}

		return {
			user: buildPublicUser(user),
			workspace,
		}
	},

	// OAuth
	async handleOAuthLogin(data: {
		provider: string
		providerUid: string
		email: string
		name: string
		accessToken: string
		refreshToken?: string
	}) {
		const {
			provider,
			providerUid,
			email,
			name,
			accessToken,
			refreshToken,
		} = data

		// 1. Check if OAuth account exists
		const existingOauth = await authRepository.findOauthAccount(
			provider,
			providerUid,
		)
		if (existingOauth) {
			return existingOauth.user
		}

		// 2. Check if user with email already exists (link account)
		let user = await authRepository.findUserByEmail(email)

		// 3. If user doesn't exist, create them
		if (!user) {
			user = await authRepository.createUser({
				name,
				email,
				passwordHash: null,
			})

			// Create default workspace for new OAuth users
			const workspaceName = `${name}'s Workspace`
			const baseSlug = slugify(workspaceName, {
				lower: true,
				strict: true,
				trim: true,
			})
			const randomSuffix = crypto.randomBytes(4).toString("hex")

			const workspace = await authRepository.createWorkspace({
				name: workspaceName,
				slug: `${baseSlug}-${randomSuffix}`,
			})
			await authRepository.createWorkspaceMember({
				userId: user.id,
				workspaceId: workspace.id,
			})

			await authRepository.markUserEmailVerified(user.id)
		}

		// 4. Create OAuth account record linked to the user
		await authRepository.createOauthAccount({
			userId: user.id,
			provider,
			providerUid,
			accessToken,
			...(refreshToken !== undefined && { refreshToken }),
		})
		return user
	},

	// Login
	async login(
		data: LoginInput & {
			userAgent?: string
			ipAddress?: string
		},
	) {
		const { email, password, userAgent, ipAddress } = data

		const user = await authRepository.findUserByEmail(email)
		if (!user || !user.passwordHash) {
			throw new UnauthorizedError("Invalid email or password")
		}

		const valid = await verifyPassword(user.passwordHash, password)
		if (!valid) {
			throw new UnauthorizedError("Invalid email or password")
		}

		// create a new device session
		const session = await authRepository.createSession({
			userId: user.id,
			...(userAgent && { userAgent }),
			...(ipAddress && { ipAddress }),
		})

		const membership = await authRepository.findPrimaryWorkspaceForUser(
			user.id,
		)
		if (!membership) {
			throw new BadRequestError("No workspace found")
		}

		const accessToken = await generateAccessToken({
			sub: user.id,
			sessionId: session.id,
			workspaceId: membership.workspaceId,
		})

		const refreshToken = await generateRefreshToken({
			sub: user.id,
			sessionId: session.id,
		})

		// store hashed refresh token in DB for rotation
		await authRepository.createRefreshToken({
			sessionId: session.id,
			tokenHash: hashToken(refreshToken),
			expiresAt: new Date(Date.now() + THIRTY_DAYS_IN_MS),
		})

		return {
			publicUser: buildPublicUser(user),
			accessToken,
			refreshToken,
		}
	},

	// Refresh
	async refresh(refreshToken: string) {
		let payload: RefreshTokenPayload
		try {
			const decoded = await verifyRefreshToken(refreshToken)
			payload = decoded.payload as RefreshTokenPayload
		} catch {
			throw new UnauthorizedError("Invalid refresh token")
		}

		const session = await authRepository.findSessionById(
			payload.sessionId as string,
		)
		if (!session) {
			throw new UnauthorizedError("Session invalid")
		}

		const storedToken = await authRepository.findLatestRefreshToken(
			session.id,
		)
		if (!storedToken) {
			throw new UnauthorizedError("Refresh token invalid")
		}

		// verify the refresh token matches what we stored (support both argon2 legacy and HMAC)
		const valid =
			verifyToken(refreshToken, storedToken.tokenHash) ||
			(await verifyPassword(storedToken.tokenHash, refreshToken).catch(() => false))

		if (!valid) {
			throw new UnauthorizedError("Refresh token invalid")
		}

		// rotate: revoke old, issue new
		await authRepository.revokeRefreshToken(storedToken.id)

		const membership = await authRepository.findPrimaryWorkspaceForUser(
			session.userId,
		)
		if (!membership) {
			throw new UnauthorizedError()
		}

		const newAccessToken = await generateAccessToken({
			sub: session.userId,
			sessionId: session.id,
			workspaceId: membership.workspaceId,
		})

		const newRefreshToken = await generateRefreshToken({
			sub: session.userId,
			sessionId: session.id,
		})

		await authRepository.createRefreshToken({
			sessionId: session.id,
			tokenHash: hashToken(newRefreshToken),
			expiresAt: new Date(Date.now() + THIRTY_DAYS_IN_MS),
		})

		await authRepository.updateSessionLastSeen(session.id)

		return {
			accessToken: newAccessToken,
			refreshToken: newRefreshToken,
		}
	},

	// Logout
	async logout(refreshToken: string) {
		const { payload } = await verifyRefreshToken(refreshToken)
		const sessionId = payload.sessionId as string

		await authRepository.revokeSession(sessionId)
		await authRepository.revokeAllRefreshTokens(sessionId)
	},

	// Panic Button: kill all sessions for the user
	async logoutAll(userId: string) {
		await authRepository.revokeAllSessionsForUser(userId)
		await authRepository.revokeAllRefreshTokensForUser(userId)
	},

	// Email Verification
	async verifyEmail(token: string) {
		const tokenHash = hashEmailToken(token)
		const verification =
			await authRepository.findEmailVerification(tokenHash)

		if (!verification) {
			throw new BadRequestError("Invalid or expired verification token")
		}

		await authRepository.markUserEmailVerified(verification.userId)
		await authRepository.markEmailVerificationUsed(verification.id)
	},

	async resendVerification(email: string) {
		const user = await authRepository.findUserByEmail(email)
		if (!user || user.emailVerified) return

		const rawToken = generateEmailToken()
		await authRepository.createEmailVerification({
			userId: user.id,
			tokenHash: hashEmailToken(rawToken),
			expiresAt: new Date(
				Date.now() + env.EMAIL_VERIFY_TOKEN_TTL_HOURS * ONE_HOUR_IN_MS,
			),
		})

		const verificationUrl = `${env.CLIENT_URL}/verify-email?token=${rawToken}`

		if (resend) {
			await resend.emails
				.send({
					from: env.EMAIL_FROM,
					to: email,
					subject: "Verify your email address - Varta",
					html: buildVerificationEmail(user.name, verificationUrl),
				})
				.catch((err) =>
					console.error("Failed to send verification email:", err),
				)
		} else {
			console.log(
				`[DEV] Email verification link for ${email}: ${verificationUrl}`,
			)
		}
	},

	// Forgot Password
	async forgotPassword(email: string) {
		const user = await authRepository.findUserByEmail(email)

		if (!user) return

		const rawToken = generateEmailToken()

		await authRepository.createPasswordResetToken({
			userId: user.id,
			tokenHash: hashEmailToken(rawToken),
			expiresAt: new Date(
				Date.now() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000,
			),
		})

		const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}`

		if (resend) {
			await resend.emails
				.send({
					from: env.EMAIL_FROM,
					to: email,
					subject: "Reset your password - Varta",
					html: buildResetPasswordEmail(user.name, resetUrl),
				})
				.catch((err) =>
					console.error("Failed to send reset email:", err),
				)
		} else {
			console.log(`[DEV] Password reset link for ${email}: ${resetUrl}`)
		}
	},

	// Reset Password
	async resetPassword(token: string, newPassword: string) {
		const tokenHash = hashEmailToken(token)
		const resetToken =
			await authRepository.findPasswordResetToken(tokenHash)

		if (!resetToken) {
			throw new BadRequestError("Invalid or expired reset token")
		}

		const passwordHash = await hashPassword(newPassword)

		await authRepository.updatePassword(resetToken.userId, passwordHash)
		await authRepository.markPasswordResetTokenUsed(resetToken.id)

		// revoke all sessions so the user must log back in with new password
		await authRepository.revokeAllSessionsForUser(resetToken.userId)
	},

	// Session Management
	async getSessions(userId: string) {
		return authRepository.getUserSessions(userId)
	},

	async revokeSession(userId: string, sessionId: string) {
		await authRepository.revokeSessionById(sessionId, userId)
	},
}
