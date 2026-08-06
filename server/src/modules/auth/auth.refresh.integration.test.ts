import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { hashToken } from "@/common/utils/auth/token-hash.ts"
import { generateRefreshToken } from "@/common/utils/auth/jwt.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { authService } from "./auth.service.ts"

const runDatabaseTests = process.env.RUN_AUTH_DATABASE_TESTS === "true"

test(
	"refresh rotation is single-winner and revokes the family on later reuse",
	{ skip: !runDatabaseTests },
	async () => {
		const marker = randomUUID()
		const user = await prisma.user.create({
			data: {
				email: `refresh-${marker}@example.test`,
				name: "Refresh integration test",
			},
		})

		try {
			const workspace = await prisma.workspace.create({
				data: { name: "Refresh integration", slug: `refresh-${marker}` },
			})
			await prisma.workspaceMember.create({
				data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
			})
			const session = await prisma.session.create({
				data: { userId: user.id },
			})
			const tokenId = randomUUID()
			const refreshToken = await generateRefreshToken({
				sub: user.id,
				sessionId: session.id,
				jti: tokenId,
			})
			await prisma.refreshToken.create({
				data: {
					id: tokenId,
					sessionId: session.id,
					tokenHash: hashToken(refreshToken),
					expiresAt: new Date(Date.now() + 60_000),
				},
			})

			const outcomes = await Promise.allSettled([
				authService.refresh(refreshToken),
				authService.refresh(refreshToken),
			])
			assert.equal(
				outcomes.filter((outcome) => outcome.status === "fulfilled").length,
				1,
			)
			assert.equal(
				outcomes.filter((outcome) => outcome.status === "rejected").length,
				1,
			)

			const activeAfterRace = await prisma.refreshToken.count({
				where: { sessionId: session.id, revokedAt: null },
			})
			const sessionAfterRace = await prisma.session.findUniqueOrThrow({
				where: { id: session.id },
			})
			assert.equal(activeAfterRace, 1)
			assert.equal(sessionAfterRace.revokedAt, null)

			await assert.rejects(() => authService.refresh(refreshToken))

			const activeAfterReuse = await prisma.refreshToken.count({
				where: { sessionId: session.id, revokedAt: null },
			})
			const sessionAfterReuse = await prisma.session.findUniqueOrThrow({
				where: { id: session.id },
			})
			assert.equal(activeAfterReuse, 0)
			assert.notEqual(sessionAfterReuse.revokedAt, null)
		} finally {
			await prisma.user.delete({ where: { id: user.id } })
			await prisma.$disconnect()
		}
	},
)
