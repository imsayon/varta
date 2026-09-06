import { prisma } from "@/infra/database/prisma.ts"
import { queueService } from "@/infra/queues/queue.service.ts"
import { Prisma, type NotificationPriority } from "@prisma/client"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { NotificationChannel } from "./notification.types.ts"
import { logger } from "@/infra/observability/logger.ts"
import { reserveNotificationQuotaTx } from "@/modules/billing/billing.service.ts"

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX_ITEMS = 100
const LEASE_MS = 300_000

function configValue(config: Prisma.JsonValue, key: string): number | undefined {
	if (!config || typeof config !== "object" || Array.isArray(config)) return undefined
	const value = (config as Record<string, Prisma.JsonValue>)[key]
	return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

export const digestService = {
	async acceptNotification(input: {
		workspaceId: string
		templateId: string
		subscriberId: string
		idempotencyKey: string
		payload: Record<string, unknown>
		channels: NotificationChannel[]
		priority: NotificationPriority
		digestConfig: Prisma.JsonValue
	}) {
		const windowMs = Math.max(
			1_000,
			configValue(input.digestConfig, "windowMs") ?? DEFAULT_WINDOW_MS,
		)
		const maxItems = Math.max(
			1,
			Math.floor(configValue(input.digestConfig, "maxItems") ?? DEFAULT_MAX_ITEMS),
		)
		try {
			const result = await prisma.$transaction(
				async (tx) => {
					await reserveNotificationQuotaTx(tx, input.workspaceId, input.idempotencyKey, 1)
					const notification = await tx.notification.create({
						data: {
							workspaceId: input.workspaceId,
							templateId: input.templateId,
							subscriberId: input.subscriberId,
							idempotencyKey: input.idempotencyKey,
							triggerPayload: input.payload as Prisma.InputJsonValue,
							channels: input.channels,
							status: "ENQUEUED",
							priority: input.priority,
						},
					})
					const batches: Array<{ id: string; workspaceId: string; windowExpiresAt: Date }> = []
					for (const channel of input.channels) {
						const aggregationKey = [
							input.workspaceId,
							input.subscriberId,
							input.templateId,
							channel,
						].join(":")
						await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${aggregationKey}))`
						const now = new Date()
						let batch = await tx.digestBatch.findFirst({
							where: {
								aggregationKey,
								status: "OPEN",
								windowExpiresAt: { gt: now },
							},
							orderBy: { createdAt: "desc" },
							include: { _count: { select: { items: true } } },
						})
						if (!batch || batch._count.items >= maxItems) {
							batch = await tx.digestBatch.create({
								data: {
									workspaceId: input.workspaceId,
									subscriberId: input.subscriberId,
									templateId: input.templateId,
									channel,
									aggregationKey,
									windowStartedAt: now,
									windowExpiresAt: new Date(now.getTime() + windowMs),
								},
								include: { _count: { select: { items: true } } },
							})
						}
						await tx.digestBatchItem.create({
							data: {
								batchId: batch.id,
								sourceNotificationId: notification.id,
								channel,
								content: input.payload as Prisma.InputJsonValue,
							},
						})
						batches.push({
							id: batch.id,
							workspaceId: batch.workspaceId,
							windowExpiresAt: batch.windowExpiresAt,
						})
					}
					return { notification, batches }
				},
				{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
			)
			for (const batch of result.batches) {
				try {
					await queueService.enqueueDigest(
						{ version: 1, workspaceId: batch.workspaceId, batchId: batch.id },
						batch.windowExpiresAt.getTime() - Date.now(),
					)
				} catch (error) {
					logger.warn({ err: error, batchId: batch.id }, "Digest scheduling deferred to reconciliation")
				}
			}
			return { created: true, notification: result.notification }
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
				const existing = await prisma.notification.findUnique({
					where: {
						workspaceId_idempotencyKey: {
							workspaceId: input.workspaceId,
							idempotencyKey: input.idempotencyKey,
						},
					},
				})
				if (existing) return { created: false, notification: existing }
			}
			throw error
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
			const channel = batch.channel as NotificationChannel
			if (!Object.values(NotificationChannel).includes(channel)) {
				throw new Error(`Unsupported digest channel: ${batch.channel}`)
			}
			const accepted = await acceptNotification({
				workspaceId: batch.workspaceId,
				templateId: batch.templateId,
				subscriberId: batch.subscriberId,
				idempotencyKey: `digest:${batch.id}`,
				payload: {
					digestBatchId: batch.id,
					sourceNotificationIds: batch.items.map((item) => item.sourceNotificationId),
					digestItems: batch.items.map((item) => item.content),
				},
				channels: [channel],
				priority: "NORMAL",
				scheduledAt: null,
				smartTimingRequested: false,
				billable: false,
			})
			await prisma.digestBatch.updateMany({
				where: { id: batch.id, status: "PROCESSING", claimedBy: workerId, leaseUntil: { gt: new Date() } },
				data: {
					aggregateNotificationId: accepted.notification.id,
					leaseUntil: null,
				},
			})
		} catch (error) {
			await prisma.digestBatch.updateMany({
				where: { id: batch.id, status: "PROCESSING", claimedBy: workerId, leaseUntil: { gt: new Date() } },
				data: { status: "FAILED", leaseUntil: null },
			})
			throw error
		}
	},
}
