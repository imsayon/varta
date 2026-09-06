import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { disconnectDatabase, prisma } from "@/infra/database/prisma.ts"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { NotificationChannel } from "./notification.types.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"

const runQueueTests = process.env.RUN_NOTIFICATION_QUEUE_TESTS === "true"

test(
	"outbox publication is recoverable and produces one deterministic BullMQ job",
	{ skip: !runQueueTests },
	async () => {
		const [
			{ closeQueues },
			{ connectRedis, disconnectRedis },
			{ inAppQueue, digestQueue },
			{ dispatchOutboxBatch },
			{ digestService },
		] = await Promise.all([
			import("@/infra/queues/queue.factory.ts"),
			import("@/infra/redis/redis.connection.ts"),
			import("@/infra/queues/queues.ts"),
			import("./outbox-dispatcher.service.ts"),
			import("./digest.service.ts"),
		])
		await connectRedis()
		const marker = randomUUID()
		const fixture = await createOwnedTestWorkspace("Outbox")
		const { workspace } = fixture
		let jobId: string | undefined
		let digestJobId: string | undefined
		try {
			const template = await prisma.template.create({
				data: { workspaceId: workspace.id, name: "Template", channels: {} },
			})
			const subscriber = await prisma.subscriber.create({
				data: { workspaceId: workspace.id, externalId: `subscriber-${marker}` },
			})
			const accepted = await acceptNotification({
				workspaceId: workspace.id,
				templateId: template.id,
				subscriberId: subscriber.id,
				idempotencyKey: `outbox-${marker}`,
				payload: {},
				channels: [NotificationChannel.IN_APP],
				priority: "NORMAL",
				scheduledAt: null,
				smartTimingRequested: false,
			})
			const delivery = await prisma.delivery.findFirstOrThrow({
				where: { notificationId: accepted.notification.id },
			})
			jobId = `delivery-${delivery.id}`

			assert.equal(await dispatchOutboxBatch(`first-${marker}`), 1)
			assert.ok(await inAppQueue.getJob(jobId))
			await prisma.outboxIntent.update({
				where: { deliveryId: delivery.id },
				data: { status: "FAILED", availableAt: new Date(), publishedAt: null },
			})
			assert.equal(await dispatchOutboxBatch(`retry-${marker}`), 1)
			assert.ok(await inAppQueue.getJob(jobId))
			assert.equal(
				await prisma.outboxIntent.count({
					where: { deliveryId: delivery.id, status: "PUBLISHED" },
				}),
				1,
			)

			const digest = await digestService.acceptNotification({
				workspaceId: workspace.id,
				templateId: template.id,
				subscriberId: subscriber.id,
				idempotencyKey: `digest-source-${marker}`,
				payload: { orderId: marker },
				channels: [NotificationChannel.IN_APP],
				priority: "NORMAL",
				digestConfig: { windowMs: 60_000, maxItems: 10 },
			})
			const duplicateDigest = await digestService.acceptNotification({
				workspaceId: workspace.id,
				templateId: template.id,
				subscriberId: subscriber.id,
				idempotencyKey: `digest-source-${marker}`,
				payload: { orderId: marker },
				channels: [NotificationChannel.IN_APP],
				priority: "NORMAL",
				digestConfig: { windowMs: 60_000, maxItems: 10 },
			})
			assert.equal(digest.created, true)
			assert.equal(duplicateDigest.created, false)
			assert.equal(
				await prisma.delivery.count({ where: { notificationId: digest.notification.id } }),
				0,
			)
			const digestItem = await prisma.digestBatchItem.findFirstOrThrow({
				where: { sourceNotificationId: digest.notification.id },
				include: { batch: true },
			})
			digestJobId = `digest-${digestItem.batchId}`
			assert.ok(await digestQueue.getJob(digestJobId))
			await (await digestQueue.getJob(digestJobId))!.remove()
			await prisma.digestBatch.update({ where: { id: digestItem.batchId }, data: {
				status: "PROCESSING", claimedBy: "interrupted-worker", leaseUntil: new Date(0),
			} })
			const { reconciliationService } = await import("./reconciliation.service.ts")
			await reconciliationService.reconcileStuckNotifications()
			assert.ok(await digestQueue.getJob(digestJobId), "expired processing digest is rescheduled")
			await digestService.processBatch(digestItem.batchId, "recovery-worker")
			await prisma.digestBatch.update({ where: { id: digestItem.batchId }, data: { leaseUntil: new Date(0) } })
			await digestService.processBatch(digestItem.batchId, "recovery-worker-again")
			assert.equal(await prisma.notification.count({ where: { workspaceId: workspace.id, idempotencyKey: `digest:${digestItem.batchId}` } }), 1)
			assert.equal(await prisma.usageLedger.count({ where: { workspaceId: workspace.id } }), 2, "digest aggregate and recovery do not add usage")
		} finally {
			if (jobId) await (await inAppQueue.getJob(jobId))?.remove()
			if (digestJobId) await (await digestQueue.getJob(digestJobId))?.remove()
			await fixture.cleanup()
			await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
		}
	},
)
