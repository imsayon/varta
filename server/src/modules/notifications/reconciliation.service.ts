import { prisma } from "@/infra/database/prisma.ts"
import { queueService } from "@/infra/queues/queue.service.ts"
import { logger } from "@/infra/observability/logger.ts"
import { dispatchOutboxBatch } from "./outbox-dispatcher.service.ts"
import { recomputeAggregateStatus } from "./notification-status.service.ts"
import { reconciliationLastSuccess, reconciliationRuns } from "@/infra/observability/metrics.ts"
import { withTrace } from "@/infra/observability/tracing.ts"

const RECONCILIATION_STALE_MINUTES = 10

export const reconciliationService = {
	async reconcileStuckNotifications(): Promise<number> {
		const startedAt = Date.now()
		try {
		return await withTrace("reconciliation.run", {
			"db.system.name": "postgresql",
		}, async () => {
		const cutoff = new Date(
			Date.now() - RECONCILIATION_STALE_MINUTES * 60_000,
		)

		await dispatchOutboxBatch(`reconciliation:${crypto.randomUUID()}`)
		const expiredOpenBatches = await prisma.digestBatch.findMany({
			where: { OR: [
				{ status: "OPEN", windowExpiresAt: { lte: new Date() } },
				{ status: "PROCESSING", leaseUntil: { lt: new Date() } },
			] },
			take: 100,
			select: { id: true, workspaceId: true },
		})
		for (const batch of expiredOpenBatches) {
			await queueService.enqueueDigest(
				{ version: 1, workspaceId: batch.workspaceId, batchId: batch.id },
				0,
			)
		}

		// Delivery outcomes commit before parent status; repair that interruption gap.
		const terminalParents = await prisma.notification.findMany({
			where: {
				status: { in: ["PENDING", "ENQUEUED"] },
				deliveries: { some: {}, none: { status: { notIn: ["SUCCESS", "DLQ"] } } },
			},
			orderBy: { createdAt: "asc" },
			take: 100,
			select: { id: true, workspaceId: true },
		})
		for (const parent of terminalParents) {
			await recomputeAggregateStatus(parent.workspaceId, parent.id)
		}

		const terminalDigests = await prisma.digestBatch.findMany({
			where: {
				status: "PROCESSING",
				aggregateNotificationId: { not: null },
				aggregateNotification: {
					deliveries: {
						some: {},
						none: { status: { notIn: ["SUCCESS", "DLQ"] } },
					},
				},
			},
			take: 100,
			include: {
				aggregateNotification: { include: { deliveries: true } },
			},
		})
		for (const batch of terminalDigests) {
			const delivered = batch.aggregateNotification?.deliveries.every(
				(delivery) => delivery.status === "SUCCESS",
			)
			await prisma.digestBatch.updateMany({
				where: { id: batch.id, status: "PROCESSING" },
				data: { status: delivered ? "DELIVERED" : "FAILED", leaseUntil: null },
			})
		}

		// Also repair projection after interruption between batch and source updates.
		const terminalSources = await prisma.notification.findMany({
			where: {
				status: "ENQUEUED",
				digestSourceItems: {
					some: {},
					none: { batch: { status: { in: ["OPEN", "PROCESSING"] } } },
				},
			},
			take: 100,
			select: {
				id: true, workspaceId: true,
				digestSourceItems: { select: { batch: { select: { status: true } } } },
			},
		})
		for (const source of terminalSources) {
			const statuses = source.digestSourceItems.map((entry) => entry.batch.status)
			const status = statuses.every((value) => value === "DELIVERED")
				? "DELIVERED"
				: statuses.some((value) => value === "DELIVERED") ? "PARTIAL" : "FAILED"
			await prisma.notification.updateMany({
				where: { id: source.id, workspaceId: source.workspaceId, status: "ENQUEUED" },
				data: { status },
			})
		}

		const retryableDeliveries = await prisma.delivery.findMany({
			where: {
				AND: [
					{ OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] },
					{ OR: [
						{ status: { in: ["PENDING", "FAILED"] }, updatedAt: { lte: cutoff } },
						{ status: "RUNNING", OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
					] },
				],
			},
			orderBy: { updatedAt: "asc" },
			take: 100,
			select: { id: true, workspaceId: true, notificationId: true, channel: true },
		})

		let reconciledCount = 0
		for (const delivery of retryableDeliveries) {
			try {
				const replayed = await queueService.replayDelivery(
					{
						version: 1,
						notificationId: delivery.notificationId,
						deliveryId: delivery.id,
						workspaceId: delivery.workspaceId,
						correlationId: `reconcile-${delivery.id}`,
					},
					delivery.channel,
				)
				if (replayed) reconciledCount += 1
			} catch (error) {
				logger.error(
					{ err: error, deliveryId: delivery.id },
					"Failed to reconcile stuck notification",
				)
			}
		}

		if (reconciledCount > 0) {
			logger.info(
				{ reconciledCount },
				"Reconciled stuck notifications successfully",
			)
		}

		reconciliationRuns.inc({ outcome: reconciledCount > 0 ? "repaired" : "clean" })
		reconciliationLastSuccess.setToCurrentTime()
		return reconciledCount
		})
		} catch (error) {
			reconciliationRuns.inc({ outcome: "failed" })
			logger.error({ err: error, durationMs: Date.now() - startedAt }, "Reconciliation run failed")
			throw error
		}
	},
}
