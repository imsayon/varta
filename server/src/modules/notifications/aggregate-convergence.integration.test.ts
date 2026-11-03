import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import test, { mock } from "node:test"
import type { Prisma } from "@prisma/client"
import { prisma, disconnectDatabase } from "@/infra/database/prisma.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { recomputeAggregateStatus } from "./notification-status.service.ts"
import { deliveryRepository } from "./delivery.repository.ts"
import { executeDelivery } from "./delivery-execution.service.ts"
import { NotificationChannel } from "./notification.types.ts"

function barrier() {
	let resolve!: () => void
	const promise = new Promise<void>((done) => { resolve = done })
	return { promise, resolve }
}

test("aggregate completion serializes stale snapshots and reconciliation repairs persisted-outcome interruption", {
	skip: process.env.RUN_NOTIFICATION_QUEUE_TESTS !== "true", timeout: 30_000,
}, async () => {
	const { connectRedis, disconnectRedis } = await import("@/infra/redis/redis.connection.ts")
	const { closeQueues } = await import("@/infra/queues/queue.factory.ts")
	const { emailQueue, inAppQueue } = await import("@/infra/queues/queues.ts")
	const { reconciliationService } = await import("./reconciliation.service.ts")
	await connectRedis()
	const fixture = await createOwnedTestWorkspace("Aggregate convergence")
	const workspaceId = fixture.workspace.id
	const jobIds: string[] = []
	try {
		const template = await prisma.template.create({ data: { workspaceId, name: "Aggregate", channels: { inapp: { title: "Synthetic", body: "Synthetic" } } } })
		const subscriber = await prisma.subscriber.create({ data: { workspaceId, externalId: randomUUID() } })
		const accept = async (channels = [NotificationChannel.IN_APP, NotificationChannel.EMAIL]) => {
			const result = await acceptNotification({ workspaceId, templateId: template.id, subscriberId: subscriber.id,
				idempotencyKey: randomUUID(), payload: {}, channels, priority: "NORMAL", scheduledAt: null, smartTimingRequested: false })
			const deliveries = await prisma.delivery.findMany({ where: { notificationId: result.notification.id }, orderBy: { channel: "asc" } })
			jobIds.push(...deliveries.map((delivery) => `delivery-${delivery.id}`))
			return { notificationId: result.notification.id, deliveries }
		}
		for (const [firstOutcome, secondOutcome, expected] of [
			["SUCCESS", "SUCCESS", "DELIVERED"], ["SUCCESS", "DLQ", "PARTIAL"], ["DLQ", "DLQ", "FAILED"],
		] as const) {
			const accepted = await accept()
			const [first, second] = accepted.deliveries
			assert.ok(first && second)
			for (const delivery of accepted.deliveries) {
				const claim = await deliveryRepository.claim(workspaceId, delivery.id)
				assert.ok(claim)
				if (delivery.id === first.id) await deliveryRepository.finish(workspaceId, delivery.id, claim.owner, claim.attempt.id, firstOutcome, { provider: "synthetic", durationMs: 1 })
				else Object.assign(delivery, { claim })
			}
			const selected = barrier()
			const release = barrier()
			const secondStarted = barrier()
			let ordinal = 0
			let interceptStatus = true
			let secondPid = 0
			let secondDone = false
			const transaction = prisma.$transaction.bind(prisma)
			prisma.$transaction = (async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
				if (!interceptStatus) return transaction(callback)
				const current = ++ordinal
				return transaction(async (tx) => {
					if (current === 2) {
						secondPid = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0]!.pid
						secondStarted.resolve()
					}
					return callback(new Proxy(tx, { get(target, property) {
						if (property !== "notification" || current !== 1) return Reflect.get(target, property)
						return new Proxy(target.notification, { get(delegate, method) {
							if (method !== "findFirst") return Reflect.get(delegate, method)
							return async (args: Prisma.NotificationFindFirstArgs) => {
								const value = await delegate.findFirst(args)
								selected.resolve()
								await release.promise
								return value
							}
						} })
					} }))
				})
			}) as typeof prisma.$transaction
			let a: Promise<unknown> | undefined
			let b: Promise<unknown> | undefined
			try {
				a = recomputeAggregateStatus(workspaceId, accepted.notificationId)
				await selected.promise
				const secondClaim = (second as typeof second & { claim: NonNullable<Awaited<ReturnType<typeof deliveryRepository.claim>>> }).claim
				interceptStatus = false
				assert.equal(await deliveryRepository.finish(workspaceId, second.id, secondClaim.owner, secondClaim.attempt.id, secondOutcome, { provider: "synthetic", durationMs: 1 }), true)
				interceptStatus = true
				b = recomputeAggregateStatus(workspaceId, accepted.notificationId).then(() => { secondDone = true })
				await secondStarted.promise
				let blocked = false
				for (let i = 0; i < 400 && !secondDone; i++) {
					const activity = await prisma.$queryRaw<Array<{ wait_event_type: string | null }>>`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${secondPid}`
					if (activity[0]?.wait_event_type === "Lock") { blocked = true; break }
					await delay(5)
				}
				assert.ok(blocked || secondDone, "second recompute must finish or reach the PostgreSQL serialization lock")
				release.resolve()
				await Promise.all([a, b])
				const parent = await prisma.notification.findUniqueOrThrow({ where: { id: accepted.notificationId } })
				console.log(JSON.stringify({ oracle: "overlap", firstOutcome, secondOutcome, blocked, observed: parent.status, expected }))
				assert.equal(parent.status, expected)
			} finally {
				release.resolve()
				await Promise.allSettled([a, b])
				prisma.$transaction = transaction
			}
			await reconciliationService.reconcileStuckNotifications()
			assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: accepted.notificationId } })).status, expected)
		}
		const interrupted = await accept([NotificationChannel.IN_APP])
		const delivery = interrupted.deliveries[0]!
		let effects = 0
		const finish = deliveryRepository.finish.bind(deliveryRepository)
		const interruption = mock.method(deliveryRepository, "finish", async (...args: Parameters<typeof finish>) => {
			assert.equal(await finish(...args), true)
			throw new Error("Synthetic interruption after persisted outcome")
		})
		try {
			await assert.rejects(executeDelivery({ version: 1, workspaceId, notificationId: interrupted.notificationId, deliveryId: delivery.id }, NotificationChannel.IN_APP,
				async () => { effects++; return { success: true, provider: "synthetic" } }), /Synthetic interruption/)
		} finally { interruption.mock.restore() }
		assert.equal((await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).status, "SUCCESS")
		assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: interrupted.notificationId } })).status, "ENQUEUED")
		await reconciliationService.reconcileStuckNotifications()
		const repaired = (await prisma.notification.findUniqueOrThrow({ where: { id: interrupted.notificationId } })).status
		console.log(JSON.stringify({ oracle: "persisted-outcome-interruption", observed: repaired, effects }))
		assert.equal(repaired, "DELIVERED")
		await executeDelivery({ version: 1, workspaceId, notificationId: interrupted.notificationId, deliveryId: delivery.id }, NotificationChannel.IN_APP,
			async () => { effects++; return { success: true, provider: "synthetic" } })
		assert.equal(effects, 1, "terminal outcome recovery must not replay provider effect")
		assert.equal(await prisma.deliveryAttempt.count({ where: { deliveryId: delivery.id } }), 1)
		assert.equal(await prisma.usageLedger.count({ where: { workspaceId } }), 4, "completion and recovery never reserve quota again")
	} finally {
		mock.restoreAll()
		for (const id of jobIds) for (const queue of [emailQueue, inAppQueue]) await (await queue.getJob(id))?.remove()
		await fixture.cleanup()
		await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
	}
})
