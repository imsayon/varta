import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import type { Prisma } from "@prisma/client"
import { prisma, disconnectDatabase } from "@/infra/database/prisma.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"
import { encryptConfig } from "@/common/utils/crypto.util.ts"
import { generateAccessToken } from "@/common/utils/auth/jwt.ts"
import { apiKeyService } from "@/modules/api-keys/api-key.service.ts"
import { notificationOrchestrator } from "./notification.orchestrator.ts"
import { notificationRepository } from "./notification.repository.ts"
import { executeDelivery } from "./delivery-execution.service.ts"
import { NotificationChannel, NotificationPriority } from "./notification.types.ts"

type TriggerEnvelope = { data: Awaited<ReturnType<typeof notificationOrchestrator.triggerNotification>> }

test("first-wins replay preserves accepted identity before mutable preflight and retains mutable automatic retries", {
	skip: process.env.RUN_NOTIFICATION_DATABASE_TESTS !== "true", timeout: 30_000,
}, async (t) => {
	const [{ app }, { connectRedis, disconnectRedis, redis }, { closeQueues }] = await Promise.all([
		import("@/app.ts"), import("@/infra/redis/redis.connection.ts"), import("@/infra/queues/queue.factory.ts"),
	])
	await connectRedis()
	const a = await createOwnedTestWorkspace("Replay A")
	const b = await createOwnedTestWorkspace("Replay B")
	const workspaceId = a.workspace.id
	const server = app.listen(0, "127.0.0.1")
	await new Promise<void>(resolve => server.once("listening", resolve))
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	const origin = `http://127.0.0.1:${address.port}`
	const accessToken = await generateAccessToken({ sub: a.user.id, sessionId: randomUUID(), workspaceId })
	const key = randomUUID()
	const schedule = new Date(Date.now() + 3_600_000).toISOString()
	const channels = { email: { subject: "Before {{value}}", htmlBody: "<p>{{value}}</p>" }, inapp: { title: "Before", body: "{{value}}" } }
	const template = await prisma.template.create({ data: { workspaceId, name: "Replay", channels } })
	const subscriber = await prisma.subscriber.create({ data: { workspaceId, externalId: "replay-recipient", email: "before@example.test" } })
	const provider = await prisma.providerConfig.create({ data: { workspaceId, channel: "email", provider: "resend", isActive: true,
		config: encryptConfig({ apiKey: "synthetic-only-before", fromAddress: "before@example.test" }) as Prisma.InputJsonValue } })
	const apiKey = await apiKeyService.create(workspaceId, "Replay fixture", ["notifications:trigger", "notifications:retry"])
	const otherKey = await apiKeyService.create(b.workspace.id, "Other tenant fixture", ["notifications:trigger"])
	const input = { templateId: template.id, subscriberExternalId: subscriber.externalId, payload: { value: "original" },
		options: { channels: [NotificationChannel.EMAIL], scheduledAt: schedule, priority: NotificationPriority.NORMAL, smartTiming: false as const } }
	const post = (path: string, body: unknown, idempotencyKey = key, credential: string | null = apiKey.fullKey) => fetch(`${origin}/api/v1/workspaces/${path}`, {
		method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey, ...(credential ? { "X-API-Key": credential, Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify(body),
	})
	const triggerPath = `${workspaceId}/notifications/trigger`
	const snapshot = () => prisma.notification.findUniqueOrThrow({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: key } },
		include: { deliveries: { orderBy: { id: "asc" }, include: { outboxIntent: true } } } })
	try {
		await t.test("lost 202 and changed input replay stored truth despite disabled or changed dependencies", async () => {
			// Simulate a lost caller response by discarding the successful HTTP response body.
			assert.equal((await post(triggerPath, input)).status, 202)
			const before = await snapshot()
			await prisma.providerConfig.update({ where: { id: provider.id }, data: { isActive: false } })
			await prisma.template.update({ where: { id: template.id }, data: { isActive: false, channels: {} } })
			await prisma.subscriber.update({ where: { id: subscriber.id }, data: { email: "changed@example.test", preferences: { email: false } } })
			const replay = await post(triggerPath, input)
			assert.equal(replay.status, 202, "accepted key must replay before mutable preflight")
			const body = await replay.json() as TriggerEnvelope
			assert.deepEqual(body.data, { notificationId: before.id, status: before.status, channels: ["EMAIL"], scheduledAt: schedule,
				delayMs: body.data.delayMs, duplicate: true })
			assert.ok(body.data.delayMs > 0 && body.data.delayMs <= 3_600_000)
			const changed = await post(triggerPath, { templateId: "now-missing", subscriberExternalId: "now-missing", payload: { value: "replacement" },
				options: { channels: ["IN_APP"], scheduledAt: "2099-01-01T00:00:00Z", priority: "HIGH" } })
			assert.equal(changed.status, 202)
			const changedBody = (await changed.json() as TriggerEnvelope).data
			assert.deepEqual({ ...changedBody, delayMs: 0 }, { ...body.data, delayMs: 0 })
			assert.ok(changedBody.delayMs > 0 && changedBody.delayMs <= body.data.delayMs)
			assert.deepEqual(await snapshot(), before)
			assert.equal(await prisma.usageLedger.count({ where: { workspaceId, operationId: `notification:${workspaceId}:${key}` } }), 1)
			assert.equal(await prisma.notification.count({ where: { workspaceId, idempotencyKey: key } }), 1)
			assert.equal((await post(triggerPath, input, randomUUID())).status, 400, "new keys still require mutable preflight")
			assert.equal((await post(triggerPath, { ...input, templateId: randomUUID() }, randomUUID())).status, 404)
			await prisma.notification.update({ where: { id: before.id }, data: { status: "FAILED", scheduledAt: new Date(0) } })
			const elapsed = await post(triggerPath, input)
			assert.equal(elapsed.status, 202)
			assert.deepEqual((await elapsed.json() as TriggerEnvelope).data, {
				notificationId: before.id, status: "FAILED", channels: ["EMAIL"],
				scheduledAt: new Date(0).toISOString(), delayMs: 0, duplicate: true,
			})
		})

		await t.test("HTTP trust boundaries and workspace rate limits still precede duplicate lookup", async () => {
			assert.equal((await post(triggerPath, input, key, null)).status, 401)
			assert.equal((await post(triggerPath, input, key, otherKey.fullKey)).status, 404)
			const denied = await apiKeyService.create(workspaceId, "No trigger scope", ["subscribers:read"])
			assert.equal((await post(triggerPath, input, key, denied.fullKey)).status, 403)
			assert.equal((await post(triggerPath, { ...input, options: { scheduledAt: "invalid" } })).status, 400)
			// Exhaust only this unique synthetic workspace's real limiter, without changing its policy.
			await redis.set(`rl_trigger_10:${workspaceId}`, "10", { PX: 10_000 })
			assert.equal((await post(triggerPath, input)).status, 429)
			await redis.del(`rl_trigger_10:${workspaceId}`)
		})

		await t.test("concurrent first requests, uniqueness fallback and same keys in another tenant keep persisted schedules", async () => {
			await prisma.template.update({ where: { id: template.id }, data: { channels, isActive: true } })
			await prisma.subscriber.update({ where: { id: subscriber.id }, data: { preferences: {} } })
			await prisma.providerConfig.update({ where: { id: provider.id }, data: { isActive: true } })
			const concurrentKey = randomUUID()
			const results = await Promise.all([schedule, "2098-01-01T00:00:00Z"].map(scheduledAt => notificationOrchestrator.triggerNotification(workspaceId, concurrentKey,
				{ ...input, options: { ...input.options, scheduledAt } })))
			assert.equal(results.filter(result => !result.duplicate).length, 1)
			assert.equal(new Set(results.map(result => result.notificationId)).size, 1)
			const persisted = await prisma.notification.findUniqueOrThrow({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: concurrentKey } } })
			assert.ok(results.every(result => result.scheduledAt === persisted.scheduledAt?.toISOString()))
			assert.equal(await prisma.delivery.count({ where: { notificationId: persisted.id } }), 1)
			assert.equal(await prisma.outboxIntent.count({ where: { delivery: { notificationId: persisted.id } } }), 1)
			assert.equal(await prisma.usageLedger.count({ where: { operationId: `notification:${workspaceId}:${concurrentKey}` } }), 1)
			const lookup = t.mock.method(notificationRepository, "findByIdempotencyKey", async () => null)
			try {
				const raced = await notificationOrchestrator.triggerNotification(workspaceId, concurrentKey, { ...input, options: { ...input.options, scheduledAt: "2097-01-01T00:00:00Z" } })
				assert.equal(raced.duplicate, true)
				assert.equal(raced.scheduledAt, persisted.scheduledAt?.toISOString())
			} finally { lookup.mock.restore() }
			const templateB = await prisma.template.create({ data: { workspaceId: b.workspace.id, name: "Other", channels: { inapp: { title: "Tenant B", body: "Body" } } } })
			const subscriberB = await prisma.subscriber.create({ data: { workspaceId: b.workspace.id, externalId: subscriber.externalId } })
			const other = await notificationOrchestrator.triggerNotification(b.workspace.id, key, { templateId: templateB.id, subscriberExternalId: subscriberB.externalId,
				payload: {}, options: { channels: [NotificationChannel.IN_APP], priority: NotificationPriority.NORMAL, smartTiming: false as const } })
			assert.equal(other.duplicate, false)
			assert.notEqual(other.notificationId, (await snapshot()).id)
			assert.equal(await prisma.usageLedger.count({ where: { operationId: `notification:${b.workspace.id}:${key}` } }), 1)
		})

		await t.test("digest source responses and forced duplicate races use the actual null schedule", async () => {
			const digestTemplate = await prisma.template.create({ data: { workspaceId, name: "Digest", channels: { inapp: { title: "Digest", body: "Body" } }, digestConfig: { windowMs: 60_000 } } })
			const digestKey = randomUUID()
			const request = { templateId: digestTemplate.id, subscriberExternalId: subscriber.externalId, payload: {},
				options: { channels: [NotificationChannel.IN_APP], scheduledAt: schedule, priority: NotificationPriority.NORMAL, smartTiming: false as const } }
			const first = await notificationOrchestrator.triggerNotification(workspaceId, digestKey, request)
			assert.equal(first.scheduledAt, null)
			assert.equal(first.delayMs, 0)
			const lookup = t.mock.method(notificationRepository, "findByIdempotencyKey", async () => null)
			try {
				const raced = await notificationOrchestrator.triggerNotification(workspaceId, digestKey, request)
				assert.equal(raced.notificationId, first.notificationId)
				assert.equal(raced.duplicate, true)
				assert.equal(raced.scheduledAt, null)
				assert.equal(raced.delayMs, 0)
			} finally { lookup.mock.restore() }
			await prisma.template.update({ where: { id: digestTemplate.id }, data: { channels: {} } })
			assert.equal((await notificationOrchestrator.triggerNotification(workspaceId, digestKey, request)).notificationId, first.notificationId)
			assert.equal(await prisma.digestBatchItem.count({ where: { sourceNotificationId: first.notificationId } }), 1)
			assert.equal(await prisma.delivery.count({ where: { notificationId: first.notificationId } }), 0)
			assert.equal(await prisma.usageLedger.count({ where: { operationId: `notification:${workspaceId}:${digestKey}` } }), 1)
		})

		await t.test("automatic retries retain current content and recipient under one durable delivery; manual resend stays billable", async () => {
			const retryKey = randomUUID()
			const accepted = await notificationOrchestrator.triggerNotification(workspaceId, retryKey, { ...input, options: { channels: [NotificationChannel.EMAIL], priority: NotificationPriority.NORMAL, smartTiming: false as const } })
			const delivery = await prisma.delivery.findFirstOrThrow({ where: { notificationId: accepted.notificationId } })
			const job = { version: 1 as const, workspaceId, notificationId: accepted.notificationId, deliveryId: delivery.id }
			const seen: Array<{ id: string; email: string | null; subject: string; apiKey: string }> = []
			const send = async ({ delivery: current, prepared }: Awaited<ReturnType<typeof import("./delivery-execution.service.ts").prepareDeliveryExecution>>) => {
				assert.equal(prepared.channel, "EMAIL")
				if (prepared.channel !== "EMAIL") throw new Error("Expected email")
				seen.push({ id: current.id, email: current.notification.subscriber.email, subject: prepared.renderedContent.subject, apiKey: prepared.providerConfig.apiKey })
				return { success: false, retryable: true, provider: "injected", error: "Synthetic retry" }
			}
			await assert.rejects(executeDelivery(job, NotificationChannel.EMAIL, send), /Synthetic retry/)
			await prisma.template.update({ where: { id: template.id }, data: { isActive: false, channels: { email: { subject: "After {{value}}", htmlBody: "<p>Changed</p>" } } } })
			await prisma.subscriber.update({ where: { id: subscriber.id }, data: { email: "after@example.test", preferences: { email: false } } })
			await prisma.providerConfig.update({ where: { id: provider.id }, data: { config: encryptConfig({ apiKey: "synthetic-only-after", fromAddress: "after@example.test" }) as Prisma.InputJsonValue } })
			for (let attempt = 2; attempt <= 4; attempt++) await assert.rejects(executeDelivery(job, NotificationChannel.EMAIL, send), /Synthetic retry/)
			await executeDelivery(job, NotificationChannel.EMAIL, send)
			await executeDelivery(job, NotificationChannel.EMAIL, send)
			assert.equal(seen.length, 5)
			assert.ok(seen.every(value => value.id === delivery.id))
			assert.equal(seen[0]!.subject, "Before original")
			assert.equal(seen[1]!.subject, "After original")
			assert.equal(seen[1]!.email, "after@example.test")
			assert.equal(seen[1]!.apiKey, "synthetic-only-after")
			assert.equal((await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).status, "DLQ")
			assert.equal(await prisma.usageLedger.count({ where: { operationId: `notification:${workspaceId}:${retryKey}` } }), 1)
			await prisma.subscriber.update({ where: { id: subscriber.id }, data: { preferences: {} } })
			const before = await prisma.usageLedger.count({ where: { workspaceId } })
			const resent = await post(`${workspaceId}/notifications/${accepted.notificationId}/retry`, {})
			assert.equal(resent.status, 202)
			assert.notEqual((await resent.json() as TriggerEnvelope).data.notificationId, accepted.notificationId)
			assert.equal(await prisma.usageLedger.count({ where: { workspaceId } }), before + 1)
		})
	} finally {
		t.mock.restoreAll()
		await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
		await Promise.all([a.cleanup(), b.cleanup()])
		await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
	}
})
