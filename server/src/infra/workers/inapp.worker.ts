import { createWorker } from "../queues/queue.factory.ts"
import { QueueNames } from "../queues/queue.constants.ts"
import { SendInAppJobSchema, type DeliveryJob } from "../queues/payloads.ts"
import { executeDelivery } from "@/modules/notifications/delivery-execution.service.ts"
import { NotificationChannel } from "@/modules/notifications/notification.types.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import { publishInAppDelivery, realtimeConnectionKey } from "@/infra/realtime/realtime.events.ts"

export const worker = createWorker<DeliveryJob>(QueueNames.INAPP, async (job) => {
	const payload = SendInAppJobSchema.parse(job.data)
	await executeDelivery(payload, NotificationChannel.IN_APP, async ({ delivery, prepared }) => {
		if (prepared.channel !== "IN_APP") throw new Error("Expected in-app delivery")
		const subscriberId = delivery.notification.subscriberId
		const content = prepared.renderedContent
		await prisma.pendingInApp.upsert({
			where: { notificationId: payload.notificationId },
			create: { workspaceId: payload.workspaceId, subscriberId, notificationId: payload.notificationId,
				content: content as import("@prisma/client").Prisma.InputJsonValue },
			update: {},
		})
		const online = (await redis.sCard(realtimeConnectionKey(payload.workspaceId, subscriberId))) > 0
		// Workspace observers also need live events even when no subscriber socket is present.
		await publishInAppDelivery({ type: "in_app_delivery", workspaceId: payload.workspaceId,
			subscriberId, notificationId: payload.notificationId, content })
		return { success: true, provider: "inapp", response: { buffered: !online, live: online } }
	})
}, { concurrency: 10 })
