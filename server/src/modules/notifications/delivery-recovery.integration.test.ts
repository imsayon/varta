import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { fork } from "node:child_process"
import { once } from "node:events"
import { createServer } from "node:http"
import test from "node:test"
import { prisma, disconnectDatabase } from "@/infra/database/prisma.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { deliveryRepository } from "./delivery.repository.ts"
import { executeDelivery } from "./delivery-execution.service.ts"
import { NotificationChannel } from "./notification.types.ts"

test("delivery recovery fences expired owners, survives process death and reconstructs lost published jobs", {
	skip: process.env.RUN_NOTIFICATION_QUEUE_TESTS !== "true", timeout: 45_000,
}, async () => {
	const { connectRedis, disconnectRedis } = await import("@/infra/redis/redis.connection.ts")
	const { closeQueues } = await import("@/infra/queues/queue.factory.ts")
	const { inAppQueue } = await import("@/infra/queues/queues.ts")
	const { dispatchOutboxBatch } = await import("./outbox-dispatcher.service.ts")
	const { reconciliationService } = await import("./reconciliation.service.ts")
	await connectRedis()
	const fixture = await createOwnedTestWorkspace("Recovery")
	const workspaceId = fixture.workspace.id
	const template = await prisma.template.create({ data: { workspaceId, name: "Recovery", channels: { inapp: { title: "Recovery", body: "Test" } } } })
	const subscriber = await prisma.subscriber.create({ data: { workspaceId, externalId: randomUUID() } })
	const jobs: string[] = []
	let received = 0
	const receiver = createServer((_req, res) => { received++; res.end("accepted") }).listen(0, "127.0.0.1")
	await once(receiver, "listening")
	const receiverUrl = `http://127.0.0.1:${(receiver.address() as import("node:net").AddressInfo).port}`
	const accept = async (scheduledAt: Date | null = null) => {
		const accepted = await acceptNotification({ workspaceId, templateId: template.id, subscriberId: subscriber.id,
			idempotencyKey: randomUUID(), payload: {}, channels: [NotificationChannel.IN_APP], priority: "NORMAL", scheduledAt, smartTimingRequested: false })
		const delivery = await prisma.delivery.findFirstOrThrow({ where: { notificationId: accepted.notification.id } })
		jobs.push(`delivery-${delivery.id}`)
		return { version: 1 as const, workspaceId, deliveryId: delivery.id, notificationId: accepted.notification.id }
	}
	const expire = (deliveryId: string) => prisma.delivery.update({ where: { id: deliveryId }, data: { leaseUntil: new Date(0), updatedAt: new Date(0) } })
	try {
		const payload = await accept()
		await dispatchOutboxBatch(randomUUID())
		await (await inAppQueue.getJob(`delivery-${payload.deliveryId}`))!.remove()
		await prisma.delivery.update({ where: { id: payload.deliveryId }, data: { updatedAt: new Date(0) } })
		await reconciliationService.reconcileStuckNotifications()
		assert.ok(await inAppQueue.getJob(`delivery-${payload.deliveryId}`))
		await reconciliationService.reconcileStuckNotifications()
		const claims = await Promise.all([deliveryRepository.claim(workspaceId, payload.deliveryId), deliveryRepository.claim(workspaceId, payload.deliveryId)])
		assert.equal(claims.filter(Boolean).length, 1)
		const first = claims.find(Boolean)!
		await expire(payload.deliveryId)
		const second = (await deliveryRepository.claim(workspaceId, payload.deliveryId))!
		assert.equal(second.attempt.attemptNumber, 2)
		assert.equal(await deliveryRepository.finish(workspaceId, payload.deliveryId, first.owner, first.attempt.id, "SUCCESS", { provider: "inapp", durationMs: 1 }), false)
		assert.equal(await deliveryRepository.finish(workspaceId, payload.deliveryId, second.owner, second.attempt.id, "SUCCESS", { provider: "inapp", durationMs: 1 }), true)
		await executeDelivery(payload, NotificationChannel.IN_APP, async () => { assert.fail("terminal delivery must not send again") })
		assert.equal(await prisma.deliveryAttempt.count({ where: { deliveryId: payload.deliveryId } }), 2)

		for (const phase of ["before", "after"]) {
			const interrupted = await accept()
			const child = fork(new URL("../../testing/delivery-crash.fixture.ts", import.meta.url), [], {
				execArgv: ["--import", "tsx"], stdio: ["ignore", "inherit", "inherit", "ipc"],
				env: { ...process.env, RECOVERY_TEST_PAYLOAD: JSON.stringify(interrupted), RECOVERY_TEST_PHASE: phase, RECOVERY_TEST_RECEIVER: receiverUrl },
			})
			try {
				await Promise.race([once(child, "message"), once(child, "exit").then(() => { throw new Error("Crash fixture exited before execution boundary") }),
					new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("Crash fixture timed out")), 10_000); timer.unref() })])
			} finally { if (child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill("SIGKILL"); await exited } }
			await expire(interrupted.deliveryId)
			await executeDelivery(interrupted, NotificationChannel.IN_APP, async () => {
				await fetch(receiverUrl)
				return { success: true, provider: "inapp" }
			})
			const attempts = await prisma.deliveryAttempt.findMany({ where: { deliveryId: interrupted.deliveryId }, orderBy: { attemptNumber: "asc" } })
			assert.deepEqual(attempts.map(a => [a.attemptNumber, a.status]), [[1, "FAILED"], [2, "SUCCESS"]])
		}
		assert.equal(received, 3, "post-acceptance crash can repeat a provider effect; never claim exactly once")
		const scheduled = await accept(new Date(Date.now() + 60_000))
		assert.equal(await deliveryRepository.claim(workspaceId, scheduled.deliveryId), null)
		const exhausted = await accept()
		for (let i = 0; i < 5; i++) { assert.ok(await deliveryRepository.claim(workspaceId, exhausted.deliveryId)); await expire(exhausted.deliveryId) }
		assert.equal(await deliveryRepository.claim(workspaceId, exhausted.deliveryId), null)
		assert.equal((await prisma.delivery.findUniqueOrThrow({ where: { id: exhausted.deliveryId } })).status, "DLQ")
		assert.equal(await prisma.usageLedger.count({ where: { workspaceId } }), 5, "only original logical acceptances consume quota")
		const { app } = await import("@/app.ts")
		const { generateAccessToken } = await import("@/common/utils/auth/jwt.ts")
		const api = app.listen(0, "127.0.0.1")
		await once(api, "listening")
		try {
			await prisma.notification.update({ where: { id: exhausted.notificationId }, data: { status: "FAILED" } })
			const token = await generateAccessToken({ sub: fixture.user.id, sessionId: randomUUID(), workspaceId })
			const origin = `http://127.0.0.1:${(api.address() as import("node:net").AddressInfo).port}`
			const response = await fetch(`${origin}/api/v1/workspaces/${workspaceId}/notifications/${exhausted.notificationId}/retry`, {
				method: "POST", headers: { Authorization: `Bearer ${token}` },
			})
			assert.equal(response.status, 202)
			const body = await response.json() as { data: { notificationId: string } }
			assert.notEqual(body.data.notificationId, exhausted.notificationId)
			assert.equal(await prisma.usageLedger.count({ where: { workspaceId } }), 6, "manual resend reserves a new logical run")
			const logout = await fetch(`${origin}/api/v1/auth/logout`, { method: "POST" })
			assert.equal(logout.status, 200, "bodyless logout must not crash the auth limiter")
		} finally { api.closeAllConnections(); await new Promise<void>(resolve => api.close(() => resolve())) }
		const retryable = await accept()
		await assert.rejects(executeDelivery(retryable, NotificationChannel.IN_APP,
			async () => ({ success: false, provider: "inapp", retryable: true, error: "Temporary outage" })), /Temporary outage/)
		assert.equal((await prisma.delivery.findUniqueOrThrow({ where: { id: retryable.deliveryId } })).status, "FAILED")
		await executeDelivery(retryable, NotificationChannel.IN_APP, async () => ({ success: true, provider: "inapp" }))
		assert.deepEqual((await prisma.deliveryAttempt.findMany({ where: { deliveryId: retryable.deliveryId }, orderBy: { attemptNumber: "asc" } })).map(a => a.status), ["FAILED", "SUCCESS"])
		const permanent = await accept()
		await executeDelivery(permanent, NotificationChannel.IN_APP, async () => ({ success: false, provider: "inapp", retryable: false, error: "Recipient rejected" }))
		assert.equal((await prisma.delivery.findUniqueOrThrow({ where: { id: permanent.deliveryId } })).status, "DLQ")
		assert.equal(await prisma.usageLedger.count({ where: { workspaceId } }), 8)


	} finally {
		receiver.closeAllConnections(); await new Promise<void>(resolve => receiver.close(() => resolve()))
		for (const id of jobs) await (await inAppQueue.getJob(id))?.remove()
		await fixture.cleanup()
		await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
	}
})
