import { prisma } from "@/infra/database/prisma.ts"
import { queueService } from "@/infra/queues/queue.service.ts"
import { logger } from "@/infra/observability/logger.ts"

const RECONCILIATION_STALE_MINUTES = 10

export const reconciliationService = {
	/**
	 * Finds notifications in ENQUEUED status created >10 mins ago that have zero delivery attempts.
	 * Re-enqueues them to BullMQ queues so notifications never get stuck in ENQUEUED indefinitely.
	 */
	async reconcileStuckNotifications(): Promise<number> {
		const cutoff = new Date(
			Date.now() - RECONCILIATION_STALE_MINUTES * 60_000,
		)

		const stuckNotifications = await prisma.notification.findMany({
			where: {
				status: "ENQUEUED",
				triggeredAt: { lte: cutoff },
				deliveryAttempts: { none: {} },
			},
			take: 100,
			select: {
				id: true,
				workspaceId: true,
				channels: true,
				subscriberId: true,
				subscriber: {
					select: { email: true },
				},
			},
		})

		let reconciledCount = 0
		for (const notification of stuckNotifications) {
			try {
				const channels = notification.channels as string[]
				for (const channel of channels) {
					const deliveryId = crypto.randomUUID()
					if (channel === "EMAIL") {
						await queueService.enqueueEmail({
							notificationId: notification.id,
							deliveryId,
							workspaceId: notification.workspaceId,
							subscriberEmail:
								notification.subscriber?.email ?? "",
							renderedContent: {
								subject: "Reconciled Notification",
								html: "",
							},
							providerConfig: {
								providerName: "resend",
								fromAddress: "noreply@varta.dev",
								apiKey: "",
							},
						})
					} else if (channel === "IN_APP") {
						await queueService.enqueueInApp({
							notificationId: notification.id,
							deliveryId,
							workspaceId: notification.workspaceId,
							subscriberId: notification.subscriberId,
							renderedContent: {},
						})
					}
				}
				reconciledCount += 1
			} catch (error) {
				logger.error(
					{ err: error, notificationId: notification.id },
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

		return reconciledCount
	},
}
