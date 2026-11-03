import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import type { Prisma } from "@prisma/client"
import { prisma, disconnectDatabase } from "@/infra/database/prisma.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"
import { encryptConfig } from "@/common/utils/crypto.util.ts"
import { resendProvider } from "@/common/providers/email/resend.provider.ts"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { executeDelivery } from "./delivery-execution.service.ts"
import { NotificationChannel } from "./notification.types.ts"

test("Resend conflicts use durable attempts across recreated jobs, preserve identity/quota and exhaust at five", {
	skip: process.env.RUN_NOTIFICATION_QUEUE_TESTS !== "true", timeout: 20_000,
}, async (t) => {
	const { connectRedis, disconnectRedis } = await import("@/infra/redis/redis.connection.ts")
	const { closeQueues } = await import("@/infra/queues/queue.factory.ts")
	const { emailQueue } = await import("@/infra/queues/queues.ts")
	const { queueService } = await import("@/infra/queues/queue.service.ts")
	await connectRedis()
	const fixture = await createOwnedTestWorkspace("Resend durable conflicts")
	const workspaceId = fixture.workspace.id
	const jobs: string[] = []
	try {
		const template = await prisma.template.create({ data: { workspaceId, name: "Synthetic", channels: { email: { subject: "Subject", htmlBody: "<p>Synthetic</p>" } } } })
		const subscriber = await prisma.subscriber.create({ data: { workspaceId, externalId: randomUUID(), email: "recipient@example.test" } })
		await prisma.providerConfig.create({ data: { workspaceId, channel: "email", provider: "resend", isActive: true,
			config: encryptConfig({ apiKey: "synthetic-only-secret", fromAddress: "sender@example.test" }) as Prisma.InputJsonValue } })
		for (const scenario of ["recover", "exhaust", "payload-conflict"] as const) {
			const idempotencyKey = `resend-${scenario}-${randomUUID()}`
			const accepted = await acceptNotification({ workspaceId, templateId: template.id, subscriberId: subscriber.id,
				idempotencyKey, payload: {}, channels: [NotificationChannel.EMAIL], priority: "NORMAL", scheduledAt: null, smartTimingRequested: false })
			const delivery = await prisma.delivery.findFirstOrThrow({ where: { notificationId: accepted.notification.id } })
			const payload = { version: 1 as const, workspaceId, notificationId: accepted.notification.id, deliveryId: delivery.id }
			const jobId = `delivery-${delivery.id}`
			jobs.push(jobId)
			let calls = 0
			const requestBodies: string[] = []
			t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
				calls++
				assert.equal(_url, "https://api.resend.com/emails")
				assert.equal(new Headers(options.headers).get("idempotency-key"), delivery.id)
				requestBodies.push(String(options.body))
				if (scenario === "recover" && calls === 2) return Response.json({ id: "message_synthetic" })
				return Response.json({ name: scenario === "payload-conflict" ? "invalid_idempotent_request" : "concurrent_idempotent_requests" }, { status: 409 })
			})
			const run = async () => {
				await queueService.enqueueEmail(payload)
				const job = await emailQueue.getJob(jobId)
				assert.ok(job)
				assert.equal(job.attemptsMade, 0, "recreated BullMQ metadata starts at zero")
				try {
					await executeDelivery(job.data, NotificationChannel.EMAIL, async ({ prepared }) => {
						assert.equal(prepared.channel, "EMAIL")
						if (prepared.channel !== "EMAIL") throw new Error("Expected email")
						return { ...await resendProvider.send({ to: subscriber.email!, from: prepared.providerConfig.fromAddress,
							subject: prepared.renderedContent.subject, html: prepared.renderedContent.html,
							apiKey: prepared.providerConfig.apiKey, idempotencyKey: delivery.id }), provider: "resend" }
					})
				} finally { await job.remove() }
			}
			if (scenario === "payload-conflict") await run()
			else {
				const failures = scenario === "recover" ? 1 : 4
				for (let attempt = 1; attempt <= failures; attempt++) {
					await assert.rejects(run(), /HTTP 409/)
					assert.equal((await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).status, "FAILED")
				}
				await run()
			}
			const expectedAttempts = scenario === "recover" ? 2 : scenario === "exhaust" ? 5 : 1
			const final = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })
			assert.equal(final.status, scenario === "recover" ? "SUCCESS" : "DLQ")
			assert.equal(final.providerMessageId, scenario === "recover" ? "message_synthetic" : null)
			const attempts = await prisma.deliveryAttempt.findMany({ where: { deliveryId: delivery.id }, orderBy: { attemptNumber: "asc" } })
			assert.deepEqual(attempts.map(attempt => attempt.attemptNumber), Array.from({ length: expectedAttempts }, (_, i) => i + 1))
			assert.equal(attempts.at(-1)?.status, final.status)
			assert.equal(calls, expectedAttempts)
			await run()
			assert.equal(calls, expectedAttempts, "terminal recreated job must not invoke provider")
			assert.equal(await prisma.deliveryAttempt.count({ where: { deliveryId: delivery.id } }), expectedAttempts)
			assert.equal(new Set(requestBodies).size, 1)
			assert.equal(await prisma.notification.count({ where: { workspaceId, idempotencyKey } }), 1)
			assert.equal(await prisma.usageLedger.count({ where: { workspaceId, operationId: `notification:${workspaceId}:${idempotencyKey}` } }), 1)
			t.mock.restoreAll()
		}
		assert.equal(await prisma.usageLedger.count({ where: { workspaceId } }), 3)
	} finally {
		t.mock.restoreAll()
		for (const id of jobs) await (await emailQueue.getJob(id))?.remove()
		await fixture.cleanup()
		await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
	}
})
