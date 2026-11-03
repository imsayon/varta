import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { prisma, disconnectDatabase } from "@/infra/database/prisma.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"
import { digestService } from "./digest.service.ts"
import { NotificationChannel } from "./notification.types.ts"
import { executeDelivery } from "./delivery-execution.service.ts"

test("digest acceptance recovers after a PostgreSQL fail-once trigger and projects terminal outcomes", {
	skip: process.env.RUN_NOTIFICATION_QUEUE_TESTS !== "true", timeout: 30_000,
}, async () => {
	const { connectRedis, disconnectRedis } = await import("@/infra/redis/redis.connection.ts")
	const { closeQueues } = await import("@/infra/queues/queue.factory.ts")
	const { digestQueue, inAppQueue } = await import("@/infra/queues/queues.ts")
	const { reconciliationService } = await import("./reconciliation.service.ts")
	await connectRedis()
	const fixture = await createOwnedTestWorkspace("Digest recovery")
	const workspaceId = fixture.workspace.id
	const marker = randomUUID().replaceAll("-", "")
	const trigger = `digest_fail_${marker}`
	const batches: string[] = []
	const deliveries: string[] = []
	try {
		const template = await prisma.template.create({ data: { workspaceId, name: "Digest", channels: { inapp: { title: "Digest", body: "Body" } } } })
		const subscriber = await prisma.subscriber.create({ data: { workspaceId, externalId: marker } })
		const accept = async () => {
			const result = await digestService.acceptNotification({ workspaceId, templateId: template.id, subscriberId: subscriber.id,
				idempotencyKey: randomUUID(), payload: {}, channels: [NotificationChannel.IN_APP], priority: "NORMAL", digestConfig: { windowMs: 1000 } })
			const item = await prisma.digestBatchItem.findFirstOrThrow({ where: { sourceNotificationId: result.notification.id } })
			batches.push(item.batchId)
			await prisma.digestBatch.update({ where: { id: item.batchId }, data: { windowExpiresAt: new Date(0) } })
			return { batchId: item.batchId, sourceId: result.notification.id }
		}
		const recovered = await accept()
		// A sequence advances across rollback, making exactly the first real INSERT fail.
		await prisma.$executeRawUnsafe(`CREATE SEQUENCE varta.${trigger}`)
		await prisma.$executeRawUnsafe(`CREATE FUNCTION varta.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key = 'digest:${recovered.batchId}' AND nextval('varta.${trigger}') = 1 THEN RAISE EXCEPTION 'synthetic digest fail once'; END IF; RETURN NEW; END $$`)
		await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON varta.notifications FOR EACH ROW EXECUTE FUNCTION varta.${trigger}()`)
		await assert.rejects(digestService.processBatch(recovered.batchId, "first"), /synthetic digest fail once/)
		const failed = await prisma.digestBatch.findUniqueOrThrow({ where: { id: recovered.batchId } })
		assert.equal(failed.status, "PROCESSING", "transient failure remains sealed and recoverable")
		assert.ok(failed.leaseUntil && failed.leaseUntil.getTime() < Date.now())
		assert.equal(await prisma.notification.count({ where: { workspaceId, idempotencyKey: `digest:${recovered.batchId}` } }), 0)
		assert.equal(await prisma.usageLedger.count({ where: { workspaceId } }), 1)
		await digestService.processBatch(recovered.batchId, "retry")
		await prisma.digestBatch.update({ where: { id: recovered.batchId }, data: { leaseUntil: new Date(0) } })
		await digestService.processBatch(recovered.batchId, "recreated-job")
		const aggregate = await prisma.notification.findUniqueOrThrow({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: `digest:${recovered.batchId}` } } })
		assert.equal(await prisma.notification.count({ where: { workspaceId, idempotencyKey: `digest:${recovered.batchId}` } }), 1)
		const delivery = await prisma.delivery.findFirstOrThrow({ where: { notificationId: aggregate.id } })
		deliveries.push(delivery.id)
		assert.equal(await prisma.delivery.count({ where: { notificationId: aggregate.id } }), 1)
		assert.equal(await prisma.outboxIntent.count({ where: { deliveryId: delivery.id } }), 1)
		assert.equal(await prisma.usageLedger.count({ where: { workspaceId } }), 1, "nonbillable aggregate/recovery preserve source quota")
		await executeDelivery({ version: 1, workspaceId, notificationId: aggregate.id, deliveryId: delivery.id }, NotificationChannel.IN_APP,
			async () => ({ success: true, provider: "synthetic" }))
		await reconciliationService.reconcileStuckNotifications()
		assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: recovered.sourceId } })).status, "DELIVERED")
		await prisma.notification.update({ where: { id: recovered.sourceId }, data: { status: "ENQUEUED" } })
		await reconciliationService.reconcileStuckNotifications()
		assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: recovered.sourceId } })).status, "DELIVERED", "repair interruption between terminal batch and source projection")
		assert.equal(await prisma.deliveryAttempt.count({ where: { deliveryId: delivery.id } }), 1)

		const exhausted = await accept()
		await digestService.processBatch(exhausted.batchId, "exhaustion")
		const exhaustedBatch = await prisma.digestBatch.findUniqueOrThrow({ where: { id: exhausted.batchId } })
		const exhaustedDelivery = await prisma.delivery.findFirstOrThrow({ where: { notificationId: exhaustedBatch.aggregateNotificationId! } })
		deliveries.push(exhaustedDelivery.id)
		for (let attempt = 1; attempt <= 5; attempt++) {
			const run = executeDelivery({ version: 1, workspaceId, notificationId: exhaustedDelivery.notificationId, deliveryId: exhaustedDelivery.id }, NotificationChannel.IN_APP,
				async () => ({ success: false, retryable: true, provider: "synthetic", error: "Synthetic outage" }))
			if (attempt < 5) await assert.rejects(run, /Synthetic outage/)
			else await run
		}
		await reconciliationService.reconcileStuckNotifications()
		assert.equal((await prisma.digestBatch.findUniqueOrThrow({ where: { id: exhausted.batchId } })).status, "FAILED")
		assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: exhausted.sourceId } })).status, "FAILED")
		assert.equal(await prisma.deliveryAttempt.count({ where: { deliveryId: exhaustedDelivery.id } }), 5)

		const terminal = await accept()
		await prisma.digestBatch.update({ where: { id: terminal.batchId }, data: { channel: "UNSUPPORTED" } })
		await digestService.processBatch(terminal.batchId, "terminal")
		await reconciliationService.reconcileStuckNotifications()
		assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: terminal.sourceId } })).status, "FAILED")
		assert.equal(await prisma.usageLedger.count({ where: { workspaceId } }), 3)
		assert.equal(await prisma.notification.count({ where: { workspaceId } }), 5)
		assert.equal(await prisma.delivery.count({ where: { workspaceId } }), 2)
	} finally {
		await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON varta.notifications`)
		await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS varta.${trigger}()`)
		await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS varta.${trigger}`)
		for (const id of batches) await (await digestQueue.getJob(`digest-${id}`))?.remove()
		for (const id of deliveries) await (await inAppQueue.getJob(`delivery-${id}`))?.remove()
		await fixture.cleanup()
		await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
	}
})
