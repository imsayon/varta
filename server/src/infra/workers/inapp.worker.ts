import { Worker } from "bullmq"
import type { Job } from "bullmq"
import { getQueueConnection } from "../queues/queue.connection.ts"
import type { SendInAppJobDto } from "../queues/inapp.queue.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { deliveryAttemptRepository } from "@/modules/notifications/delivery-attempt.repository.ts"
import { recomputeAggregateStatus } from "@/modules/notifications/notification-status.service.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import {
	publishInAppDelivery,
	realtimeConnectionKey,
} from "@/infra/realtime/realtime.events.ts"

export const inAppWorker = new Worker(
	"inapp-queue",
	async (job: Job<SendInAppJobDto>) => {
		const startedAt = new Date()
		const attempt = await deliveryAttemptRepository.create({
			notificationId: job.data.notificationId,
			channel: "IN_APP",
			deliveryId: job.data.deliveryId,
			attemptNumber: job.attemptsMade + 1,
			provider: "inapp",
			status: "RUNNING",
			startedAt,
			enqueuedAt: startedAt,
		})

		try {
			const existing = await prisma.pendingInApp.findFirst({
				where: {
					notificationId: job.data.notificationId,
					deliveredAt: null,
				},
			})
			if (!existing) {
				await prisma.pendingInApp.create({
					data: {
						workspaceId: job.data.workspaceId,
						subscriberId: job.data.subscriberId,
						notificationId: job.data.notificationId,
						content: job.data
							.renderedContent as unknown as import("@prisma/client").Prisma.InputJsonValue,
					},
				})
			}
			const online =
				(await redis.scard(
					realtimeConnectionKey(
						job.data.workspaceId,
						job.data.subscriberId,
					),
				)) > 0
			if (online) {
				await publishInAppDelivery({
					type: "in_app_delivery",
					workspaceId: job.data.workspaceId,
					subscriberId: job.data.subscriberId,
					notificationId: job.data.notificationId,
					content: job.data.renderedContent,
				})
			}
			await deliveryAttemptRepository.update(attempt.id, {
				status: "SUCCESS",
				providerResponse: { buffered: !online, live: online },
				finishedAt: new Date(),
				durationMs: Date.now() - startedAt.getTime(),
			})
			await recomputeAggregateStatus(job.data.notificationId)
		} catch (error: unknown) {
			await deliveryAttemptRepository.update(attempt.id, {
				status: "FAILED",
				errorMessage:
					error instanceof Error
						? error.message
						: "In-app buffering failed",
				finishedAt: new Date(),
				durationMs: Date.now() - startedAt.getTime(),
			})
			await recomputeAggregateStatus(job.data.notificationId)
			throw error
		}
	},
	{ connection: getQueueConnection(), concurrency: 10 },
)
