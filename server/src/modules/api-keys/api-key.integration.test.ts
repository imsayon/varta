import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { disconnectDatabase, prisma } from "@/infra/database/prisma.ts"
import { apiKeyService } from "./api-key.service.ts"

const runDatabaseTests = process.env.RUN_AUTH_DATABASE_TESTS === "true"

test(
	"API keys are one-time, scoped, expiring, and softly revoked",
	{ skip: !runDatabaseTests },
	async () => {
		const marker = randomUUID()
		const workspace = await prisma.workspace.create({
			data: { name: "API key integration", slug: `api-key-${marker}` },
		})
		try {
			const created = await apiKeyService.create(
				workspace.id,
				"Integration key",
				["notifications:trigger"],
				new Date(Date.now() + 60_000),
			)
			assert.ok(created.fullKey.startsWith(`${created.prefix}_`))
			assert.equal("keyHash" in created, false)
			const verified = await apiKeyService.verify(created.fullKey)
			assert.equal(verified?.id, created.id)
			assert.deepEqual(verified?.permissions, ["notifications:trigger"])

			await apiKeyService.revoke(workspace.id, created.id)
			assert.equal(await apiKeyService.verify(created.fullKey), null)
			assert.equal(
				(await prisma.apiKey.findUniqueOrThrow({ where: { id: created.id } }))
					.isActive,
				false,
			)

			const expiring = await apiKeyService.create(
				workspace.id,
				"Expired key",
				[],
				new Date(Date.now() + 60_000),
			)
			await prisma.apiKey.update({
				where: { id: expiring.id },
				data: { expiresAt: new Date(Date.now() - 1_000) },
			})
			assert.equal(await apiKeyService.verify(expiring.fullKey), null)
		} finally {
			await prisma.workspace.delete({ where: { id: workspace.id } })
			await disconnectDatabase()
		}
	},
)
