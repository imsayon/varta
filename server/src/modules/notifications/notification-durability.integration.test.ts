import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { disconnectDatabase, prisma } from "@/infra/database/prisma.ts"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { claimOutboxIntents } from "./outbox.repository.ts"
import { recomputeAggregateStatus } from "./notification-status.service.ts"
import { NotificationChannel } from "./notification.types.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"

const runDatabaseTests = process.env.RUN_NOTIFICATION_DATABASE_TESTS === "true"

test(
	"notification acceptance, idempotency, leasing, and aggregation are durable",
	{ skip: !runDatabaseTests },
	async () => {
		const { connectRedis, disconnectRedis } = await import("@/infra/redis/redis.connection.ts")
		await connectRedis()
		const marker = randomUUID()
		const fixture = await createOwnedTestWorkspace("Durability")
		const { workspace } = fixture
		try {
			const template = await prisma.template.create({
				data: { workspaceId: workspace.id, name: "Template", channels: {} },
			})
			const subscriber = await prisma.subscriber.create({
				data: { workspaceId: workspace.id, externalId: `subscriber-${marker}` },
			})
			const input = {
				workspaceId: workspace.id,
				templateId: template.id,
				subscriberId: subscriber.id,
				idempotencyKey: `accept-${marker}`,
				payload: { marker },
				channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
				priority: "NORMAL" as const,
				scheduledAt: null,
				smartTimingRequested: false,
			}
			const results = await Promise.all([
				acceptNotification({ ...input, channels: [...input.channels] }),
				acceptNotification({ ...input, channels: [...input.channels] }),
			])
			assert.equal(results.filter((result) => result.created).length, 1)
			assert.equal(new Set(results.map((result) => result.notification.id)).size, 1)
			const notificationId = results[0]!.notification.id
			assert.equal(await prisma.delivery.count({ where: { notificationId } }), 2)
			assert.equal(
				await prisma.outboxIntent.count({
					where: { delivery: { notificationId } },
				}),
				2,
			)
			assert.equal(
				await prisma.usageLedger.count({
					where: { operationId: `notification:${workspace.id}:${input.idempotencyKey}` },
				}),
				1,
			)

			const claims = await Promise.all([
				claimOutboxIntents(`owner-a-${marker}`),
				claimOutboxIntents(`owner-b-${marker}`),
			])
			assert.equal(claims.flat().length, 2)
			assert.equal(new Set(claims.flat().map((intent) => intent.id)).size, 2)

			const deliveries = await prisma.delivery.findMany({
				where: { notificationId },
				orderBy: { channel: "asc" },
			})
			await prisma.delivery.update({
				where: { id: deliveries[0]!.id },
				data: { status: "SUCCESS" },
			})
			await prisma.delivery.update({
				where: { id: deliveries[1]!.id },
				data: { status: "DLQ" },
			})
			assert.equal(
				await recomputeAggregateStatus(workspace.id, notificationId),
				"PARTIAL",
			)

			await assert.rejects(() =>
				acceptNotification({
					...input,
					idempotencyKey: `invalid-${marker}`,
					subscriberId: randomUUID(),
					channels: [NotificationChannel.EMAIL],
				}),
			)
			assert.equal(
				await prisma.notification.count({
					where: { workspaceId: workspace.id, idempotencyKey: `invalid-${marker}` },
				}),
				0,
			)
			assert.equal(
				await prisma.usageLedger.count({
					where: { operationId: `notification:${workspace.id}:invalid-${marker}` },
				}),
				0,
			)
		} finally {
			await fixture.cleanup()
			await Promise.allSettled([disconnectRedis(), disconnectDatabase()])
		}
	},
)
