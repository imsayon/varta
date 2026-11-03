import { prisma } from "@/infra/database/prisma.ts"
import type { DeliveryStatus, NotificationStatus } from "@prisma/client"

type ChannelState = {
	channel: string
	status: "PENDING" | "SUCCESS" | "FAILED"
}

function resolveChannelState(status: DeliveryStatus): ChannelState["status"] {
	if (status === "SUCCESS") return "SUCCESS"
	if (status === "DLQ") return "FAILED"
	return "PENDING"
}

export async function recomputeAggregateStatus(
	workspaceId: string,
	notificationId: string,
): Promise<NotificationStatus> {
	const status = await prisma.$transaction(async (tx) => {
		// Serialize snapshots and writes so a slower channel cannot restore stale status.
		await tx.$queryRaw`SELECT id FROM varta.notifications WHERE id = ${notificationId}::uuid AND workspace_id = ${workspaceId}::uuid FOR UPDATE`
		const notification = await tx.notification.findFirst({
			where: { id: notificationId, workspaceId },
			select: {
				id: true,
				channels: true,
				deliveries: {
					select: { channel: true, status: true },
				},
			},
		})

		if (!notification) {
			throw new Error(`Notification ${notificationId} not found`)
		}

		const states = notification.channels.map((channel) =>
			resolveChannelState(
				notification.deliveries.find((delivery) => delivery.channel === channel)
					?.status ?? "PENDING",
			),
		)

		let status: NotificationStatus = "ENQUEUED"
		if (states.length > 0 && states.every((state) => state === "SUCCESS")) {
			status = "DELIVERED"
		} else if (states.some((state) => state === "PENDING")) {
			status = "ENQUEUED"
		} else if (states.some((state) => state === "SUCCESS")) {
			status = "PARTIAL"
		} else if (states.length > 0 && states.every((state) => state === "FAILED")) {
			status = "FAILED"
		}

		await tx.notification.updateMany({
			where: { id: notificationId, workspaceId },
			data: { status },
		})

		return status
	})
	const { invalidateAnalyticsCache } = await import("@/modules/analytics/analytics.service.ts")
	await invalidateAnalyticsCache(workspaceId)
	return status
}
