import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { disconnectDatabase, prisma } from "@/infra/database/prisma.ts"
import { authRepository } from "./auth.repository.ts"

const runDatabaseTests = process.env.RUN_AUTH_DATABASE_TESTS === "true"

test(
	"registration and one-time account tokens are transactionally consumed",
	{ skip: !runDatabaseTests },
	async () => {
		const marker = randomUUID()
		const email = `lifecycle-${marker}@example.test`
		const verificationHash = `verify-${marker}`
		const registrations = await Promise.allSettled([
			authRepository.createRegistration({
				name: "Lifecycle test",
				email,
				passwordHash: "password-hash",
				workspaceName: "Lifecycle one",
				workspaceSlug: `lifecycle-one-${marker}`,
				verificationTokenHash: verificationHash,
				verificationExpiresAt: new Date(Date.now() + 60_000),
			}),
			authRepository.createRegistration({
				name: "Lifecycle test",
				email,
				passwordHash: "password-hash",
				workspaceName: "Lifecycle two",
				workspaceSlug: `lifecycle-two-${marker}`,
				verificationTokenHash: `${verificationHash}-duplicate`,
				verificationExpiresAt: new Date(Date.now() + 60_000),
			}),
		])
		assert.equal(
			registrations.filter((result) => result.status === "fulfilled").length,
			1,
		)
		assert.equal(
			registrations.filter((result) => result.status === "rejected").length,
			1,
		)

		const user = await prisma.user.findUniqueOrThrow({
			where: { email },
			include: { workspaceMembers: true, emailVerifications: true },
		})
		const workspaceId = user.workspaceMembers[0]?.workspaceId
		assert.ok(workspaceId)
		assert.equal(user.workspaceMembers.length, 1)
		assert.equal(user.emailVerifications.length, 1)

		try {
			const activeVerificationHash = user.emailVerifications[0]!.tokenHash
			const verificationResults = await Promise.all([
				authRepository.consumeEmailVerification(activeVerificationHash),
				authRepository.consumeEmailVerification(activeVerificationHash),
			])
			assert.equal(verificationResults.filter(Boolean).length, 1)
			assert.equal(
				(await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
					.emailVerified,
				true,
			)

			const session = await prisma.session.create({ data: { userId: user.id } })
			await prisma.refreshToken.create({
				data: {
					sessionId: session.id,
					tokenHash: `refresh-${marker}`,
					expiresAt: new Date(Date.now() + 60_000),
				},
			})
			const resetHash = `reset-${marker}`
			await prisma.passwordResetToken.create({
				data: {
					userId: user.id,
					tokenHash: resetHash,
					expiresAt: new Date(Date.now() + 60_000),
				},
			})
			const resetResults = await Promise.all([
				authRepository.consumePasswordReset(resetHash, "new-password-hash"),
				authRepository.consumePasswordReset(resetHash, "new-password-hash"),
			])
			assert.equal(resetResults.filter(Boolean).length, 1)
			assert.notEqual(
				(await prisma.session.findUniqueOrThrow({ where: { id: session.id } }))
					.revokedAt,
				null,
			)
			assert.equal(
				await prisma.refreshToken.count({
					where: { sessionId: session.id, revokedAt: null },
				}),
				0,
			)
		} finally {
			await prisma.user.delete({ where: { id: user.id } })
			await prisma.workspace.delete({ where: { id: workspaceId } })
			await disconnectDatabase()
		}
	},
)
