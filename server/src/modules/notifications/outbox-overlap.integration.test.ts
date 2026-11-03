import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { prisma, disconnectDatabase } from "@/infra/database/prisma.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { executeDelivery } from "./delivery-execution.service.ts"
import { NotificationChannel } from "./notification.types.ts"
import type { DeliveryJob } from "@/infra/queues/payloads.ts"

function barrier() {
	let resolve!: () => void
	const promise = new Promise<void>(done => { resolve = done })
	return { promise, resolve }
}

test("overlapping outbox publishers preserve ownership, recover ambiguous publication and retain durable delivery identity", {
	skip: process.env.RUN_NOTIFICATION_QUEUE_TESTS !== "true", timeout: 45_000,
}, async (t) => {
	const { connectRedis, disconnectRedis } = await import("@/infra/redis/redis.connection.ts")
	const { closeQueues } = await import("@/infra/queues/queue.factory.ts")
	const { inAppQueue } = await import("@/infra/queues/queues.ts")
	const { queueService } = await import("@/infra/queues/queue.service.ts")
	const { DEFAULT_JOB_OPTIONS } = await import("@/infra/queues/queue.options.ts")
	const { dispatchOutboxBatch } = await import("./outbox-dispatcher.service.ts")
	await connectRedis()
	const fixture = await createOwnedTestWorkspace("Outbox overlap")
	const workspaceId = fixture.workspace.id
	const template = await prisma.template.create({ data: {
		workspaceId, name: "Overlap", channels: { inapp: { title: "Synthetic", body: "Synthetic" } },
	} })
	const subscriber = await prisma.subscriber.create({ data: { workspaceId, externalId: randomUUID() } })
	const deliveries: DeliveryJob[] = []
	const enqueue = queueService.enqueueInApp.bind(queueService)
	const accept = async () => {
		const input = { workspaceId, templateId: template.id, subscriberId: subscriber.id,
			idempotencyKey: randomUUID(), payload: {}, channels: [NotificationChannel.IN_APP],
			priority: "NORMAL" as const, scheduledAt: null, smartTimingRequested: false }
		const accepted = await acceptNotification(input)
		assert.equal((await acceptNotification(input)).notification.id, accepted.notification.id)
		const delivery = await prisma.delivery.findFirstOrThrow({ where: { notificationId: accepted.notification.id } })
		const payload = { version: 1 as const, workspaceId, notificationId: accepted.notification.id, deliveryId: delivery.id }
		deliveries.push(payload)
		return payload
	}
	const row = (payload: DeliveryJob) => prisma.outboxIntent.findUniqueOrThrow({ where: { deliveryId: payload.deliveryId } })
	const expire = (payload: DeliveryJob) => prisma.outboxIntent.update({
		where: { deliveryId: payload.deliveryId }, data: { leaseUntil: new Date(0) },
	})
	try {
		for (const schedule of ["slow-success", "stale-failure", "stale-success"] as const) {
			const payload = await accept()
			const started = barrier()
			const release = barrier()
			let calls = 0
			const patch = t.mock.method(queueService, "enqueueInApp", async (job: DeliveryJob) => {
				calls++
				if (calls === 1) {
					if (schedule !== "stale-failure") await enqueue(job)
					started.resolve()
					await release.promise
					if (schedule === "stale-failure") throw new Error("Old publisher failed")
					return
				}
				if (schedule === "stale-success") throw new Error("New publisher failed")
				await enqueue(job)
			})
			try {
				const first = dispatchOutboxBatch(`old-${randomUUID()}`)
				await started.promise
				assert.equal((await row(payload)).status, "LEASED")
				await expire(payload)
				assert.equal(await dispatchOutboxBatch(`new-${randomUUID()}`), 1)
				const newer = await row(payload)
				assert.equal(newer.status, schedule === "stale-success" ? "FAILED" : "PUBLISHED")
				release.resolve()
				assert.equal(await first, 1)
				assert.deepEqual(await row(payload), newer, "late acknowledgement/failure cannot overwrite the new owner")
				assert.equal(calls, 2)
			} finally { release.resolve(); patch.mock.restore() }
			if ((await row(payload)).status === "FAILED") {
				await prisma.outboxIntent.update({ where: { deliveryId: payload.deliveryId }, data: { availableAt: new Date(0) } })
				assert.equal(await dispatchOutboxBatch(randomUUID()), 1)
			}
			assert.equal((await row(payload)).status, "PUBLISHED")
			assert.ok(await inAppQueue.getJob(`delivery-${payload.deliveryId}`))
		}

		const ambiguous = await accept()
		const late = barrier()
		let publication: Promise<void> | undefined
		const patch = t.mock.method(queueService, "enqueueInApp", (payload: DeliveryJob) => {
			publication = late.promise.then(() => enqueue(payload))
			return publication
		})
		try {
			assert.equal(await dispatchOutboxBatch(randomUUID()), 1)
			const failed = await row(ambiguous)
			assert.equal(failed.status, "FAILED")
			assert.equal(failed.attempts, 1)
			assert.match(failed.lastError!, /timed out/)
		} finally { patch.mock.restore() }
		await prisma.outboxIntent.update({ where: { deliveryId: ambiguous.deliveryId }, data: { availableAt: new Date(0) } })
		assert.equal(await dispatchOutboxBatch(randomUUID()), 1)
		const published = await row(ambiguous)
		late.resolve()
		await publication
		assert.deepEqual(await row(ambiguous), published)
		assert.equal(published.status, "PUBLISHED")
		const jobs = await inAppQueue.getJobs(["waiting", "delayed", "active", "completed", "failed"])
		assert.equal(jobs.filter(job => deliveries.some(payload => job.id === `delivery-${payload.deliveryId}`)).length, deliveries.length,
			"duplicate publication retains one job per delivery while the deterministic id is retained")

		let effects = 0
		for (const payload of deliveries) {
			const job = (await inAppQueue.getJob(`delivery-${payload.deliveryId}`))!
			await executeDelivery(job.data, NotificationChannel.IN_APP, async () => { effects++; return { success: true, provider: "inapp" } })
			await job.remove()
			await enqueue(payload)
			await executeDelivery((await inAppQueue.getJob(`delivery-${payload.deliveryId}`))!.data, NotificationChannel.IN_APP,
				async () => { assert.fail("recreated terminal job must not replay provider effect") })
			assert.equal(await prisma.deliveryAttempt.count({ where: { deliveryId: payload.deliveryId } }), 1)
		}
		assert.equal(effects, deliveries.length)

		const fenced = await accept()
		const sending = barrier()
		const sendFinished = barrier()
		let uncertainEffects = 0
		const oldExecution = executeDelivery(fenced, NotificationChannel.IN_APP, async () => {
			uncertainEffects++
			sending.resolve()
			await sendFinished.promise
			return { success: true, provider: "inapp", messageId: "old-provider-result" }
		})
		await sending.promise
		await executeDelivery(fenced, NotificationChannel.IN_APP,
			async () => { assert.fail("duplicate job cannot send during a live execution lease") })
		await prisma.delivery.update({ where: { id: fenced.deliveryId }, data: { leaseUntil: new Date(0) } })
		await executeDelivery(fenced, NotificationChannel.IN_APP, async () => {
			uncertainEffects++
			return { success: true, provider: "inapp", messageId: "new-provider-result" }
		})
		sendFinished.resolve()
		await oldExecution
		assert.equal(uncertainEffects, 2, "lease recovery cannot undo an uncertain external effect")
		assert.equal((await prisma.delivery.findUniqueOrThrow({ where: { id: fenced.deliveryId } })).providerMessageId, "new-provider-result")
		assert.deepEqual((await prisma.deliveryAttempt.findMany({ where: { deliveryId: fenced.deliveryId }, orderBy: { attemptNumber: "asc" } })).map(a => [a.attemptNumber, a.status]), [[1, "FAILED"], [2, "SUCCESS"]])

		const exhausted = await accept()
		let failures = 0
		for (let attempt = 1; attempt <= 5; attempt++) {
			await enqueue(exhausted)
			const job = (await inAppQueue.getJob(`delivery-${exhausted.deliveryId}`))!
			const execution = executeDelivery(job.data, NotificationChannel.IN_APP, async () => {
				failures++; return { success: false, provider: "inapp", retryable: true, error: "Synthetic retry" }
			})
			if (attempt < 5) await assert.rejects(execution, /Synthetic retry/)
			else await execution
			await job.remove()
		}
		await enqueue(exhausted)
		await executeDelivery((await inAppQueue.getJob(`delivery-${exhausted.deliveryId}`))!.data, NotificationChannel.IN_APP,
			async () => { assert.fail("recreated job must not bypass durable attempt exhaustion") })
		assert.equal(failures, 5)
		assert.deepEqual((await prisma.deliveryAttempt.findMany({ where: { deliveryId: exhausted.deliveryId }, orderBy: { attemptNumber: "asc" } })).map(a => [a.attemptNumber, a.status]),
			[[1, "FAILED"], [2, "FAILED"], [3, "FAILED"], [4, "FAILED"], [5, "DLQ"]])
		assert.equal(await prisma.notification.count({ where: { workspaceId } }), deliveries.length)
		assert.equal(await prisma.delivery.count({ where: { workspaceId } }), deliveries.length)
		assert.equal(await prisma.outboxIntent.count({ where: { workspaceId } }), deliveries.length)
		assert.equal(await prisma.usageLedger.count({ where: { workspaceId } }), deliveries.length, "only original accepted logical notifications reserve quota")
		const finalRows = await prisma.outboxIntent.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" },
			select: { id: true, deliveryId: true, status: true, attempts: true, leaseOwner: true, leaseUntil: true } })
		assert.deepEqual(finalRows.map(intent => intent.status), ["PUBLISHED", "PUBLISHED", "PUBLISHED", "PUBLISHED", "PENDING", "PENDING"])
		assert.ok(finalRows.every(intent => intent.leaseOwner === null && intent.leaseUntil === null))
		assert.equal(new Set(finalRows.map(intent => intent.deliveryId)).size, deliveries.length)
		t.diagnostic(JSON.stringify({ workspaceId, logicalNotifications: deliveries.length, quotaReservations: deliveries.length,
			finalRows, providerEffects: effects, uncertainProviderEffects: uncertainEffects, durableAttemptsOnExhaustion: failures }))
		assert.deepEqual(DEFAULT_JOB_OPTIONS.removeOnComplete, { age: 3600, count: 1000 })
		assert.deepEqual(DEFAULT_JOB_OPTIONS.removeOnFail, { age: 86400 })
	} finally {
		t.mock.restoreAll()
		for (const payload of deliveries) await (await inAppQueue.getJob(`delivery-${payload.deliveryId}`))?.remove()
		await fixture.cleanup()
		await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
	}
})
