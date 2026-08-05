import { prisma } from "@/infra/database/prisma.ts"
import type { DeliveryStatus, NotificationStatus } from "@prisma/client"

export const MAX_DELIVERY_ATTEMPTS = 5

type ChannelState = {
	channel: string
	status: "PENDING" | "SUCCESS" | "FAILED"
}

function resolveChannelState(
	attempts: Array<{ status: DeliveryStatus | null; attemptNumber: number }>,
): ChannelState["status"] {
	if (attempts.some((attempt) => attempt.status === "SUCCESS")) return "SUCCESS"

	const latest = attempts.at(-1)
	if (!latest || latest.status === "PENDING" || latest.status === "RUNNING") {
		return "PENDING"
	}

	if (
		latest.status === "FAILED" &&
		latest.attemptNumber < MAX_DELIVERY_ATTEMPTS
	) {
		return "PENDING"
	}

	return "FAILED"
}

export async function recomputeAggregateStatus(
	notificationId: string,
): Promise<NotificationStatus> {
	const notification = await prisma.notification.findUnique({
		where: { id: notificationId },
		select: {
			id: true,
			channels: true,
			deliveryAttempts: {
				select: { channel: true, status: true, attemptNumber: true },
				orderBy: { attemptNumber: "asc" },
			},
		},
	})

	if (!notification) {
		throw new Error(`Notification ${notificationId} not found`)
	}

	const states = notification.channels.map((channel) =>
		resolveChannelState(
			notification.deliveryAttempts.filter(
				(attempt) => attempt.channel === channel,
			),
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

	await prisma.notification.update({
		where: { id: notificationId },
		data: { status },
	})

	return status
}
