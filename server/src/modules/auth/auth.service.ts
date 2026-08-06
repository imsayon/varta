import crypto from "node:crypto"
import { Prisma } from "@prisma/client"
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
import { prisma } from "@/infra/database/prisma.ts"
import { logger } from "@/infra/observability/logger.ts"

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

		const workspaceName = `${name}'s Workspace`
		const baseSlug = slugify(workspaceName, {
			lower: true,
			strict: true,
			trim: true,
		})
		const randomSuffix = crypto.randomBytes(4).toString("hex")

		const rawToken = generateEmailToken()
		const { user, workspace } = await authRepository.createRegistration({
			name,
			email,
			passwordHash,
			workspaceName,
			workspaceSlug: `${baseSlug}-${randomSuffix}`,
			verificationTokenHash: hashEmailToken(rawToken),
			verificationExpiresAt: new Date(
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
				.catch(() => logger.warn("Verification email delivery failed"))
		} else {
			logger.info("Verification email delivery is not configured")
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

		const refreshTokenId = crypto.randomUUID()
		const refreshToken = await generateRefreshToken({
			sub: user.id,
			sessionId: session.id,
			jti: refreshTokenId,
		})

		// store hashed refresh token in DB for rotation
		await authRepository.createRefreshToken({
			id: refreshTokenId,
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
			if (
				typeof decoded.payload.sub !== "string" ||
				typeof decoded.payload.sessionId !== "string" ||
				typeof decoded.payload.jti !== "string" ||
				decoded.payload.type !== "refresh"
			) {
				throw new Error("Invalid refresh claims")
			}
			payload = decoded.payload as RefreshTokenPayload
		} catch {
			throw new UnauthorizedError("Invalid refresh token")
		}

		let result:
			| { kind: "rotated"; accessToken: string; refreshToken: string }
			| { kind: "reuse" }
			| { kind: "invalid" }
		try {
			result = await prisma.$transaction(
				async (tx) => {
					const storedToken = await tx.refreshToken.findUnique({
						where: { id: payload.jti },
						include: { session: true },
					})
					if (
						!storedToken ||
						storedToken.sessionId !== payload.sessionId ||
						storedToken.session.userId !== payload.sub ||
						storedToken.expiresAt <= new Date()
					) {
						return { kind: "invalid" as const }
					}

					if (storedToken.revokedAt || storedToken.session.revokedAt) {
						const revokedAt = new Date()
						await tx.session.updateMany({
							where: { id: storedToken.sessionId, revokedAt: null },
							data: { revokedAt },
						})
						await tx.refreshToken.updateMany({
							where: { sessionId: storedToken.sessionId, revokedAt: null },
							data: { revokedAt },
						})
						return { kind: "reuse" as const }
					}

					const valid =
						verifyToken(refreshToken, storedToken.tokenHash) ||
						(await verifyPassword(storedToken.tokenHash, refreshToken).catch(() => false))
					if (!valid) return { kind: "invalid" as const }

					const membership = await tx.workspaceMember.findFirst({
						where: { userId: storedToken.session.userId },
						orderBy: { createdAt: "asc" },
					})
					if (!membership) return { kind: "invalid" as const }

					const rotation = await tx.refreshToken.updateMany({
						where: {
							id: storedToken.id,
							sessionId: storedToken.sessionId,
							revokedAt: null,
						},
						data: { revokedAt: new Date() },
					})
					if (rotation.count !== 1) return { kind: "invalid" as const }

					const newRefreshTokenId = crypto.randomUUID()
					const newAccessToken = await generateAccessToken({
						sub: storedToken.session.userId,
						sessionId: storedToken.sessionId,
						workspaceId: membership.workspaceId,
					})
					const newRefreshToken = await generateRefreshToken({
						sub: storedToken.session.userId,
						sessionId: storedToken.sessionId,
						jti: newRefreshTokenId,
					})
					await tx.refreshToken.create({
						data: {
							id: newRefreshTokenId,
							sessionId: storedToken.sessionId,
							tokenHash: hashToken(newRefreshToken),
							expiresAt: new Date(Date.now() + THIRTY_DAYS_IN_MS),
						},
					})
					await tx.session.update({
						where: { id: storedToken.sessionId },
						data: { lastSeenAt: new Date() },
					})

					return {
						kind: "rotated" as const,
						accessToken: newAccessToken,
						refreshToken: newRefreshToken,
					}
				},
				{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
			)
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2034"
			) {
				throw new UnauthorizedError("Refresh token was already rotated")
			}
			throw error
		}

		if (result.kind === "reuse") {
			logger.warn("Refresh token reuse detected; session family revoked")
			throw new UnauthorizedError("Refresh token reuse detected")
		}
		if (result.kind !== "rotated") {
			throw new UnauthorizedError("Refresh token invalid")
		}
		return result
	},

	// Logout
	async logout(refreshToken?: string) {
		if (!refreshToken) return
		let payload: RefreshTokenPayload
		try {
			const decoded = await verifyRefreshToken(refreshToken)
			payload = decoded.payload as RefreshTokenPayload
		} catch {
			return
		}
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
		const verification = await authRepository.consumeEmailVerification(tokenHash)

		if (!verification) {
			throw new BadRequestError("Invalid or expired verification token")
		}

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
				.catch(() => logger.warn("Verification email delivery failed"))
		} else {
			logger.info("Verification email delivery is not configured")
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
				.catch(() => logger.warn("Password reset email delivery failed"))
		} else {
			logger.info("Password reset email delivery is not configured")
		}
	},

	// Reset Password
	async resetPassword(token: string, newPassword: string) {
		const tokenHash = hashEmailToken(token)
		const passwordHash = await hashPassword(newPassword)
		const resetToken = await authRepository.consumePasswordReset(
			tokenHash,
			passwordHash,
		)
		if (!resetToken) {
			throw new BadRequestError("Invalid or expired reset token")
		}
	},

	// Session Management
	async getSessions(userId: string) {
		return authRepository.getUserSessions(userId)
	},

	async revokeSession(userId: string, sessionId: string) {
		await authRepository.revokeSessionById(sessionId, userId)
	},
}
