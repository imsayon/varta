import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { once } from "node:events"
import { setTimeout as delay } from "node:timers/promises"
import test from "node:test"
import { Prisma } from "@prisma/client"
import { prisma, disconnectDatabase } from "@/infra/database/prisma.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"
import { generateAccessToken } from "@/common/utils/auth/jwt.ts"
import { digestService } from "./digest.service.ts"
import { notificationRepository } from "./notification.repository.ts"
import { NotificationChannel } from "./notification.types.ts"

type TransactionRunner = (work: (tx: Prisma.TransactionClient) => Promise<unknown>,
	options?: { isolationLevel?: Prisma.TransactionIsolationLevel }) => Promise<unknown>

function gate() {
	let resolve!: () => void
	const promise = new Promise<void>(done => { resolve = done })
	return { promise, resolve }
}

test("digest acceptance retries complete Serializable transactions without losing sources or charging twice", {
	skip: process.env.RUN_NOTIFICATION_QUEUE_TESTS !== "true", timeout: 30_000,
}, async (t) => {
	const [{ app }, { connectRedis, disconnectRedis }, { closeQueues }, { digestQueue }] = await Promise.all([
		import("@/app.ts"), import("@/infra/redis/redis.connection.ts"),
		import("@/infra/queues/queue.factory.ts"), import("@/infra/queues/queues.ts"),
	])
	await connectRedis()
	const fixture = await createOwnedTestWorkspace("Digest replay contention")
	const workspaceId = fixture.workspace.id
	const transaction = prisma.$transaction.bind(prisma)
	const runTransaction = transaction as unknown as TransactionRunner
	const findExisting = notificationRepository.findByIdempotencyKey
	const server = app.listen(0, "127.0.0.1")
	await once(server, "listening")
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	const token = await generateAccessToken({ sub: fixture.user.id, sessionId: randomUUID(), workspaceId })
	const template = await prisma.template.create({ data: { workspaceId, name: "Digest replay",
		channels: { inapp: { title: "Synthetic", body: "Synthetic" } }, digestConfig: { windowMs: 60_000 } } })
	const subscriber = await prisma.subscriber.create({ data: { workspaceId, externalId: randomUUID() } })
	const input = (key: string, subscriberId = subscriber.id) => ({ workspaceId, templateId: template.id,
		subscriberId, idempotencyKey: key, payload: { marker: key }, channels: [NotificationChannel.IN_APP],
		priority: "NORMAL" as const, digestConfig: { windowMs: 1000 } })
	const post = (key: string) => fetch(`http://127.0.0.1:${address.port}/api/v1/workspaces/${workspaceId}/notifications/trigger`, {
		method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": key },
		body: JSON.stringify({ templateId: template.id, subscriberExternalId: subscriber.externalId,
			payload: { marker: key }, options: { channels: ["IN_APP"] } }),
	})
	try {
		for (const sameKey of [true, false]) {
			await t.test(sameKey ? "same-key concurrent HTTP requests replay one acceptance" : "distinct-key concurrent HTTP requests retain both acceptances", async () => {
				const keys = [randomUUID(), randomUUID()]
				if (sameKey) keys[1] = keys[0]!
				let lookups = 0
				const preflight = gate()
				notificationRepository.findByIdempotencyKey = async (...args) => {
					const existing = await findExisting(...args)
					if (++lookups === 2) preflight.resolve()
					await preflight.promise
					return existing
				}
				let attempts = 0
				const snapshots = gate()
				prisma.$transaction = ((work: Parameters<TransactionRunner>[0], options: Parameters<TransactionRunner>[1]) => runTransaction(async tx => {
					// Establish both real Serializable snapshots before either acquires the quota lock.
					if (++attempts <= 2) {
						await tx.$queryRaw`SELECT 1`
						if (attempts === 2) snapshots.resolve()
						await snapshots.promise
					}
					return work(tx)
				}, options)) as typeof prisma.$transaction
				try {
					const responses = await Promise.all(keys.map(post))
					assert.deepEqual(responses.map(response => response.status), [202, 202])
					const bodies = await Promise.all(responses.map(response => response.json())) as Array<{ data: { notificationId: string; duplicate: boolean } }>
					assert.equal(new Set(bodies.map(body => body.data.notificationId)).size, sameKey ? 1 : 2)
					assert.equal(bodies.filter(body => body.data.duplicate).length, sameKey ? 1 : 0)
					assert.ok(attempts >= 3, "a real serialization conflict restarts the transaction")
					const where = { workspaceId, idempotencyKey: { in: keys } }
					assert.equal(await prisma.notification.count({ where }), sameKey ? 1 : 2)
					assert.equal(await prisma.digestBatchItem.count({ where: { sourceNotification: where } }), sameKey ? 1 : 2)
					assert.equal(await prisma.usageLedger.count({ where: { workspaceId,
						operationId: { in: keys.map(key => `notification:${workspaceId}:${key}`) } } }), sameKey ? 1 : 2)
				} finally {
					prisma.$transaction = transaction
					notificationRepository.findByIdempotencyKey = findExisting
				}
			})
		}

		await t.test("append racing expiry and sealing retries into a fresh batch and preserves every committed item", async () => {
			const recipient = await prisma.subscriber.create({ data: { workspaceId, externalId: randomUUID() } })
			const first = await digestService.acceptNotification(input(randomUUID(), recipient.id))
			const firstItem = await prisma.digestBatchItem.findFirstOrThrow({ where: { sourceNotificationId: first.notification.id }, include: { batch: true } })
			const selected = gate()
			const release = gate()
			let paused = false
			let attempts = 0
			prisma.$transaction = ((work: Parameters<TransactionRunner>[0], options: Parameters<TransactionRunner>[1]) => runTransaction(async tx => {
				attempts++
				return work(new Proxy(tx, { get(target, property) {
					if (property !== "digestBatch") return Reflect.get(target, property)
					return new Proxy(target.digestBatch, { get(delegate, method) {
						if (method !== "findFirst") return Reflect.get(delegate, method)
						return async (args: Parameters<typeof delegate.findFirst>[0]) => {
							const batch = await delegate.findFirst(args)
							if (!paused) { paused = true; selected.resolve(); await release.promise }
							return batch
						}
					} })
				} }))
			}, options)) as typeof prisma.$transaction
			const secondKey = randomUUID()
			const second = digestService.acceptNotification(input(secondKey, recipient.id))
			try {
				await selected.promise
				await delay(Math.max(0, firstItem.batch.windowExpiresAt.getTime() - Date.now() + 10))
				await digestService.processBatch(firstItem.batchId, "seal-race")
				release.resolve()
				const accepted = await second
				assert.ok(attempts >= 3, "append retry plus aggregate acceptance use fresh transactions")
				const secondItem = await prisma.digestBatchItem.findFirstOrThrow({ where: { sourceNotificationId: accepted.notification.id } })
				assert.notEqual(secondItem.batchId, firstItem.batchId)
				await prisma.digestBatch.update({ where: { id: secondItem.batchId }, data: { windowExpiresAt: new Date(0) } })
				await digestService.processBatch(secondItem.batchId, "next-batch")
				const batches = await prisma.digestBatch.findMany({ where: { id: { in: [firstItem.batchId, secondItem.batchId] } },
					include: { items: true, aggregateNotification: true } })
				assert.equal(batches.length, 2)
				for (const batch of batches) {
					const payload = batch.aggregateNotification?.triggerPayload as { sourceNotificationIds: string[]; digestItems: unknown[] }
					assert.deepEqual(payload.sourceNotificationIds, batch.items.map(item => item.sourceNotificationId))
					assert.deepEqual(payload.digestItems, batch.items.map(item => item.content))
				}
				assert.equal(await prisma.usageLedger.count({ where: { workspaceId, operationId: { in:
					[first.notification.idempotencyKey, secondKey].map(key => `notification:${workspaceId}:${key}`) } } }), 2)
				assert.equal(await prisma.usageLedger.count({ where: { workspaceId, operationId: { in:
					batches.map(batch => `notification:${workspaceId}:digest:${batch.id}`) } } }), 0, "aggregate retries are nonbillable")
			} finally {
				release.resolve()
				await Promise.allSettled([second])
				prisma.$transaction = transaction
			}
		})

		for (const serializationFailure of [true, false]) {
			await t.test(serializationFailure ? "persistent serialization conflicts stop after three attempts with no acceptance or quota" : "other database failures propagate without retry or quota", async () => {
				const marker = `digest_retry_${randomUUID().replaceAll("-", "")}`
				const key = randomUUID()
				try {
					// Sequences survive rollback, so this counts real INSERT attempts, not commits.
					await prisma.$executeRawUnsafe(`CREATE SEQUENCE varta.${marker}`)
					await prisma.$executeRawUnsafe(`CREATE FUNCTION varta.${marker}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key = '${key}' THEN PERFORM nextval('varta.${marker}'); RAISE EXCEPTION 'synthetic digest conflict' USING ERRCODE = '${serializationFailure ? "40001" : "P0001"}'; END IF; RETURN NEW; END $$`)
					await prisma.$executeRawUnsafe(`CREATE TRIGGER ${marker} BEFORE INSERT ON varta.notifications FOR EACH ROW EXECUTE FUNCTION varta.${marker}()`)
					await assert.rejects(digestService.acceptNotification(input(key)), error => {
						assert.ok(error instanceof Prisma.PrismaClientKnownRequestError)
						if (serializationFailure) assert.equal(error.code, "P2034")
						return true
					})
					const [sequence] = await prisma.$queryRawUnsafe<Array<{ last_value: bigint }>>(`SELECT last_value FROM varta.${marker}`)
					assert.equal(Number(sequence?.last_value), serializationFailure ? 3 : 1)
					assert.equal(await prisma.notification.count({ where: { workspaceId, idempotencyKey: key } }), 0)
					assert.equal(await prisma.usageLedger.count({ where: { workspaceId, operationId: `notification:${workspaceId}:${key}` } }), 0)
				} finally {
					await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${marker} ON varta.notifications`)
					await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS varta.${marker}()`)
					await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS varta.${marker}`)
				}
			})
		}
	} finally {
		prisma.$transaction = transaction
		notificationRepository.findByIdempotencyKey = findExisting
		server.closeAllConnections()
		await new Promise<void>(resolve => server.close(() => resolve()))
		for (const batch of await prisma.digestBatch.findMany({ where: { workspaceId }, select: { id: true } })) {
			await (await digestQueue.getJob(`digest-${batch.id}`))?.remove()
		}
		await fixture.cleanup()
		await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
	}
})
