import { randomUUID } from "node:crypto"
import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import { queueService } from "@/infra/queues/queue.service.ts"
import type { PreparedDelivery } from "./delivery-preparation.service.ts"
import { deliveryPreparationService } from "./delivery-preparation.service.ts"
import { Prisma } from "@prisma/client"

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX_ITEMS = 100
const LEASE_MS = 300_000

type DigestInput = {
	workspaceId: string
	subscriberId: string
	templateId: string
	notificationId: string
	channels: PreparedDelivery[]
	digestConfig: Prisma.JsonValue
}

function configValue(config: Prisma.JsonValue, key: string): number | undefined {
	if (!config || typeof config !== "object" || Array.isArray(config)) return undefined
	const value = (config as Record<string, Prisma.JsonValue>)[key]
	return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function serializeDelivery(delivery: PreparedDelivery): Prisma.InputJsonValue {
	if (delivery.channel === "EMAIL" || delivery.channel === "IN_APP") {
		return delivery.renderedContent as Prisma.InputJsonValue
	}
	return {
		eventType: delivery.eventType,
		payload: delivery.payload as Prisma.InputJsonValue,
	} as Prisma.InputJsonValue
}

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const token = randomUUID()
	const acquired = await redis.set(key, token, "PX", 5_000, "NX")
	if (acquired !== "OK") throw new Error("Digest batch is being updated; retry the request")
	try {
		return await fn()
	} finally {
		await redis.eval(
			"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
			1,
			key,
			token,
		)
	}
}

export const digestService = {
	async addNotificationToBatches(input: DigestInput): Promise<void> {
		const windowMs = Math.max(1_000, configValue(input.digestConfig, "windowMs") ?? DEFAULT_WINDOW_MS)
		const maxItems = Math.max(1, Math.floor(configValue(input.digestConfig, "maxItems") ?? DEFAULT_MAX_ITEMS))
		const now = new Date()

		for (const delivery of input.channels) {
			const aggregationKey = [
				input.workspaceId,
				input.subscriberId,
				input.templateId,
				delivery.channel,
			].join(":")
			await withLock(`digest:lock:${aggregationKey}`, async () => {
				const existingBatch = await prisma.digestBatch.findFirst({
					where: {
						aggregationKey,
						status: "OPEN",
						windowExpiresAt: { gt: now },
					},
					orderBy: { createdAt: "desc" },
					include: { _count: { select: { items: true } } },
				})
				let batchId: string
				let expiresAt: Date
				if (!existingBatch || existingBatch._count.items >= maxItems) {
					const createdBatch = await prisma.digestBatch.create({
						data: {
							workspaceId: input.workspaceId,
							subscriberId: input.subscriberId,
							templateId: input.templateId,
							channel: delivery.channel,
							aggregationKey,
							windowStartedAt: now,
							windowExpiresAt: new Date(now.getTime() + windowMs),
						},
					})
					batchId = createdBatch.id
					expiresAt = createdBatch.windowExpiresAt
					await queueService.enqueueDigest(
						{ batchId },
						expiresAt.getTime() - Date.now(),
					)
				} else {
					batchId = existingBatch.id
					expiresAt = existingBatch.windowExpiresAt
				}
				await prisma.digestBatchItem.upsert({
					where: {
						batchId_sourceNotificationId_channel: {
							batchId,
							sourceNotificationId: input.notificationId,
							channel: delivery.channel,
						},
					},
					create: {
						batchId,
						sourceNotificationId: input.notificationId,
						channel: delivery.channel,
						content: serializeDelivery(delivery),
					},
					update: {},
				})
			})
		}
	},

	async processBatch(batchId: string, workerId: string): Promise<void> {
		const now = new Date()
		const claimed = await prisma.digestBatch.updateMany({
			where: {
				id: batchId,
				OR: [
					{ status: "OPEN", windowExpiresAt: { lte: now } },
					{ status: "PROCESSING", leaseUntil: { lt: now } },
				],
			},
			data: {
				status: "PROCESSING",
				claimedBy: workerId,
				claimedAt: now,
				leaseUntil: new Date(now.getTime() + LEASE_MS),
			},
		})
		if (claimed.count === 0) return

		const batch = await prisma.digestBatch.findUnique({
			where: { id: batchId },
			include: { items: { orderBy: { createdAt: "asc" } }, template: true, subscriber: true },
		})
		if (!batch) return

		try {
			const aggregateNotification = await prisma.notification.upsert({
				where: { workspaceId_idempotencyKey: { workspaceId: batch.workspaceId, idempotencyKey: `digest:${batch.id}` } },
				create: {
					workspaceId: batch.workspaceId,
					templateId: batch.templateId,
					subscriberId: batch.subscriberId,
					idempotencyKey: `digest:${batch.id}`,
					triggerPayload: { digestBatchId: batch.id, sourceNotificationIds: batch.items.map((item) => item.sourceNotificationId) },
					channels: [batch.channel],
					status: "ENQUEUED",
				},
				update: {},
			})
			await prisma.digestBatch.update({
				where: { id: batch.id },
				data: { aggregateNotificationId: aggregateNotification.id },
			})

			const items = batch.items.map((item) => item.content as Record<string, unknown>)
			const prepared = await deliveryPreparationService.prepare(
				batch.workspaceId,
				batch.channel as "EMAIL" | "IN_APP" | "WEBHOOK",
				batch.template.channels,
				batch.subscriber as unknown as Record<string, unknown>,
				{},
				items,
			)
			const deliveryId = `digest:${batch.id}:${batch.channel.toLowerCase()}`
			if (prepared.channel === "EMAIL") {
				await queueService.enqueueEmail({
					notificationId: aggregateNotification.id,
					deliveryId,
					workspaceId: batch.workspaceId,
					subscriberEmail: batch.subscriber.email ?? "",
					renderedContent: prepared.renderedContent,
					providerConfig: prepared.providerConfig,
				})
			} else if (prepared.channel === "IN_APP") {
				await queueService.enqueueInApp({
					notificationId: aggregateNotification.id,
					deliveryId,
					workspaceId: batch.workspaceId,
					subscriberId: batch.subscriberId,
					renderedContent: prepared.renderedContent,
				})
			} else {
				await queueService.enqueueWebhook({
					notificationId: aggregateNotification.id,
					deliveryId,
					workspaceId: batch.workspaceId,
					url: prepared.providerConfig.url,
					signingSecret: prepared.providerConfig.signingSecret,
					eventType: prepared.eventType,
					payload: prepared.payload,
				})
			}
			await prisma.digestBatch.update({
				where: { id: batch.id },
				data: { status: "DELIVERED", leaseUntil: null },
			})
		} catch (error) {
			await prisma.digestBatch.update({
				where: { id: batch.id },
				data: { status: "FAILED", leaseUntil: null },
			})
			throw error
		}
	},
}
