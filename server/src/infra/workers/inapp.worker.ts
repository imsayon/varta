import { Worker } from "bullmq"
import type { Job } from "bullmq"
import { getQueueConnection, getQueuePrefix } from "../queues/queue.connection.ts"
import type { SendInAppJobDto } from "../queues/inapp.queue.ts"
import { SendInAppJobSchema } from "../queues/payloads.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { deliveryAttemptRepository } from "@/modules/notifications/delivery-attempt.repository.ts"
import { recomputeAggregateStatus } from "@/modules/notifications/notification-status.service.ts"
import { prepareDeliveryExecution } from "@/modules/notifications/delivery-execution.service.ts"
import { deliveryRepository } from "@/modules/notifications/delivery.repository.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import {
	publishInAppDelivery,
	realtimeConnectionKey,
} from "@/infra/realtime/realtime.events.ts"
import { withRemoteTrace, withTrace } from "@/infra/observability/tracing.ts"
import { compactLogIdentifiers, withLogContext } from "@/infra/observability/log-context.ts"
import { logger, logEvent } from "@/infra/observability/logger.ts"
import { providerDuration, providerRequests } from "@/infra/observability/metrics.ts"

export const inAppWorker = new Worker(
	"inapp-queue",
	async (job: Job<SendInAppJobDto>) => {
		return withLogContext(compactLogIdentifiers({
			requestId: job.data.requestId,
			correlationId: job.data.correlationId,
			notificationId: job.data.notificationId,
			deliveryId: job.data.deliveryId,
			jobId: String(job.id ?? "unknown"),
		}), () => withRemoteTrace(job.data.traceparent, "worker.inapp", { "messaging.destination.name": "inapp-queue" }, async () => {
		const payload = SendInAppJobSchema.parse(job.data)
		const execution = await prepareDeliveryExecution(
			payload.workspaceId,
			payload.deliveryId,
		)
		if (execution.prepared.channel !== "IN_APP") {
			throw new Error("In-app job references a non-in-app delivery")
		}
		const subscriberId = execution.delivery.notification.subscriberId
		const content = execution.prepared.renderedContent
		const startedAt = new Date()
		await deliveryRepository.transition(
			payload.workspaceId,
			payload.deliveryId,
			"RUNNING",
			{ provider: "inapp" },
		)
		const attempt = await deliveryAttemptRepository.create({
			notificationId: payload.notificationId,
			channel: "IN_APP",
			deliveryId: payload.deliveryId,
			attemptNumber: job.attemptsMade + 1,
			provider: "inapp",
			status: "RUNNING",
			startedAt,
			enqueuedAt: startedAt,
		})
		logger.info(
			logEvent("provider", "provider.delivery.started", { attemptId: attempt.id }),
			"In-app delivery attempt started",
		)

		try {
			const online = await withTrace("provider.inapp.deliver", {
				"messaging.destination.name": "in_app",
			}, async () => {
				await prisma.pendingInApp.upsert({
					where: { notificationId: payload.notificationId },
					create: {
						workspaceId: payload.workspaceId,
						subscriberId,
						notificationId: payload.notificationId,
						content: content as import("@prisma/client").Prisma.InputJsonValue,
					},
					update: {},
				})
				const isOnline =
					(await redis.sCard(
						realtimeConnectionKey(payload.workspaceId, subscriberId),
					)) > 0
				if (isOnline) {
					await publishInAppDelivery({
						type: "in_app_delivery",
						workspaceId: payload.workspaceId,
						subscriberId,
						notificationId: payload.notificationId,
						content,
					})
				}
				return isOnline
			})
			await deliveryAttemptRepository.update(attempt.id, {
				status: "SUCCESS",
				providerResponse: { buffered: !online, live: online },
				finishedAt: new Date(),
				durationMs: Date.now() - startedAt.getTime(),
			})
			providerRequests.inc({ provider: "inapp", channel: "in_app", outcome: "success" })
			providerDuration.observe({ provider: "inapp", channel: "in_app" }, (Date.now() - startedAt.getTime()) / 1_000)
			await deliveryRepository.transition(
				payload.workspaceId,
				payload.deliveryId,
				"SUCCESS",
				{ lastError: null },
			)
			await recomputeAggregateStatus(payload.workspaceId, payload.notificationId)
		} catch (error: unknown) {
			providerRequests.inc({ provider: "inapp", channel: "in_app", outcome: "failed" })
			providerDuration.observe({ provider: "inapp", channel: "in_app" }, (Date.now() - startedAt.getTime()) / 1_000)
			const errorMessage =
				error instanceof Error ? error.message : "In-app buffering failed"
			const terminal = job.attemptsMade + 1 >= (job.opts.attempts ?? 5)
			await deliveryAttemptRepository.update(attempt.id, {
				status: terminal ? "DLQ" : "FAILED",
				errorMessage,
				finishedAt: new Date(),
				durationMs: Date.now() - startedAt.getTime(),
			})
			await deliveryRepository.transition(
				payload.workspaceId,
				payload.deliveryId,
				terminal ? "DLQ" : "FAILED",
				{ lastError: errorMessage },
			)
			await recomputeAggregateStatus(payload.workspaceId, payload.notificationId)
			throw error
		}
		}))
	},
	{ connection: getQueueConnection(), prefix: getQueuePrefix(), concurrency: 10 },
)
