import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { prisma } from "@/infra/database/prisma.ts"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { NotificationChannel } from "./notification.types.ts"

const runQueueTests = process.env.RUN_NOTIFICATION_QUEUE_TESTS === "true"

test(
	"outbox publication is recoverable and produces one deterministic BullMQ job",
	{ skip: !runQueueTests },
	async () => {
		const [
			{ closeQueues },
			{ inAppQueue },
			{ digestQueue },
			{ dispatchOutboxBatch },
			{ digestService },
		] = await Promise.all([
			import("@/infra/queues/queue.factory.ts"),
			import("@/infra/queues/inapp.queue.ts"),
			import("@/infra/queues/digest.queue.ts"),
			import("./outbox-dispatcher.service.ts"),
			import("./digest.service.ts"),
		])
		const marker = randomUUID()
		const workspace = await prisma.workspace.create({
			data: { name: "Outbox", slug: `outbox-${marker}` },
		})
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
		} finally {
			if (jobId) await (await inAppQueue.getJob(jobId))?.remove()
			if (digestJobId) await (await digestQueue.getJob(digestJobId))?.remove()
			await prisma.workspace.delete({ where: { id: workspace.id } })
			await Promise.allSettled([closeQueues(), prisma.$disconnect()])
		}
	},
)
