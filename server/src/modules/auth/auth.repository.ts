import { prisma } from "@/shared/database/prisma.ts"

export const authRepository = {
	// ─── Users ─────────────────────────────────────────

	async findUserByEmail(email: string) {
		return prisma.user.findUnique({
			where: { email },
		})
	},

	async findUserById(id: string) {
		return prisma.user.findUnique({
			where: { id },
		})
	},

	async createUser(data: {
		name: string
		email: string
		passwordHash: string | null
	}) {
		return prisma.user.create({ data })
	},

	async markUserEmailVerified(userId: string) {
		return prisma.user.update({
			where: { id: userId },
			data: { emailVerified: true },
		})
	},

	async updatePassword(userId: string, passwordHash: string) {
		return prisma.user.update({
			where: { id: userId },
			data: { passwordHash },
		})
	},

	// ─── OAuth Accounts ────────────────────────────────

	async createOauthAccount(data: {
		userId: string
		provider: string
		providerUid: string
		accessToken: string
		refreshToken?: string
		expiresAt?: Date
	}) {
		return prisma.oauthAccount.create({ data })
	},

	async findOauthAccount(provider: string, providerUid: string) {
		return prisma.oauthAccount.findUnique({
			where: { provider_providerUid: { provider, providerUid } },
			include: { user: true },
		})
	},

	async revokeAllRefreshTokensForUser(userId: string) {
		return prisma.refreshToken.updateMany({
			where: { session: { userId }, revokedAt: null },
			data: { revokedAt: new Date() },
		})
	},

	// ─── Workspaces ────────────────────────────────────

	async createWorkspace(data: { name: string; slug: string }) {
		return prisma.workspace.create({ data })
	},

	async createWorkspaceMember(data: {
		userId: string
		workspaceId: string
	}) {
		return prisma.workspaceMember.create({
			data: { ...data, role: "OWNER" },
		})
	},

	async findPrimaryWorkspaceForUser(userId: string) {
		return prisma.workspaceMember.findFirst({
			where: { userId },
			include: { workspace: true },
			orderBy: { createdAt: "asc" },
		})
	},

	// ─── Sessions ──────────────────────────────────────

	async createSession(data: {
		userId: string
		userAgent?: string
		ipAddress?: string
	}) {
		return prisma.session.create({ data })
	},

	async findSessionById(sessionId: string) {
		return prisma.session.findFirst({
			where: { id: sessionId, revokedAt: null },
		})
	},

	async getUserSessions(userId: string) {
		return prisma.session.findMany({
			where: { userId, revokedAt: null },
			orderBy: { lastSeenAt: "desc" },
		})
	},

	async updateSessionLastSeen(sessionId: string) {
		return prisma.session.update({
			where: { id: sessionId },
			data: { lastSeenAt: new Date() },
		})
	},

	async revokeSession(sessionId: string) {
		return prisma.session.update({
			where: { id: sessionId },
			data: { revokedAt: new Date() },
		})
	},

	// revoke a single session, scoped to user for safety
	async revokeSessionById(sessionId: string, userId: string) {
		return prisma.session.updateMany({
			where: { id: sessionId, userId },
			data: { revokedAt: new Date() },
		})
	},

	async revokeAllSessionsForUser(userId: string) {
		return prisma.session.updateMany({
			where: { userId, revokedAt: null },
			data: { revokedAt: new Date() },
		})
	},

	// ─── Refresh Tokens ────────────────────────────────

	async createRefreshToken(data: {
		sessionId: string
		tokenHash: string
		expiresAt: Date
	}) {
		return prisma.refreshToken.create({ data })
	},

	async findLatestRefreshToken(sessionId: string) {
		return prisma.refreshToken.findFirst({
			where: {
				sessionId,
				revokedAt: null,
				expiresAt: { gt: new Date() },
			},
			orderBy: { createdAt: "desc" },
		})
	},

	async revokeRefreshToken(tokenId: string) {
		return prisma.refreshToken.update({
			where: { id: tokenId },
			data: { revokedAt: new Date() },
		})
	},

	async revokeAllRefreshTokens(sessionId: string) {
		return prisma.refreshToken.updateMany({
			where: { sessionId, revokedAt: null },
			data: { revokedAt: new Date() },
		})
	},

	// ─── Email Verification ────────────────────────────

	async createEmailVerification(data: {
		userId: string
		tokenHash: string
		expiresAt: Date
	}) {
		return prisma.emailVerification.create({ data })
	},

	async findEmailVerification(tokenHash: string) {
		return prisma.emailVerification.findFirst({
			where: {
				tokenHash,
				usedAt: null,
				expiresAt: { gt: new Date() },
			},
		})
	},

	async markEmailVerificationUsed(id: string) {
		return prisma.emailVerification.update({
			where: { id },
			data: { usedAt: new Date() },
		})
	},

	// ─── Password Reset ────────────────────────────────

	async createPasswordResetToken(data: {
		userId: string
		tokenHash: string
		expiresAt: Date
	}) {
		return prisma.passwordResetToken.create({ data })
	},

	async findPasswordResetToken(tokenHash: string) {
		return prisma.passwordResetToken.findFirst({
			where: {
				tokenHash,
				usedAt: null,
				expiresAt: { gt: new Date() },
			},
		})
	},

	async markPasswordResetTokenUsed(id: string) {
		return prisma.passwordResetToken.update({
			where: { id },
			data: { usedAt: new Date() },
		})
	},
}
