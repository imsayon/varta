import { Worker } from "bullmq"
import type { Job } from "bullmq"
import { getQueueConnection } from "../queues/queue.connection.ts"
import { MAX_DELIVERY_ATTEMPTS } from "../queues/queue.options.ts"
import type { SendEmailJobDto } from "../queues/email.queue.ts"
import { SendEmailJobSchema } from "../queues/payloads.ts"
import { providerFactory } from "@/common/providers/email/provider.factory.ts"
import { deliveryAttemptRepository } from "@/modules/notifications/delivery-attempt.repository.ts"
import { recomputeAggregateStatus } from "@/modules/notifications/notification-status.service.ts"
import { prepareDeliveryExecution } from "@/modules/notifications/delivery-execution.service.ts"
import { deliveryRepository } from "@/modules/notifications/delivery.repository.ts"

class EmailDeliveryError extends Error {
	constructor(message: string, readonly retryable: boolean) {
		super(message)
	}
}

export const emailWorker = new Worker(
	"email-queue",
	async (job: Job<SendEmailJobDto>) => {
		const payloadData = SendEmailJobSchema.parse(job.data)
		const {
			notificationId,
			deliveryId,
			workspaceId,
		} = payloadData
		const execution = await prepareDeliveryExecution(workspaceId, deliveryId)
		if (execution.prepared.channel !== "EMAIL") {
			throw new Error("Email job references a non-email delivery")
		}
		const { renderedContent, providerConfig } = execution.prepared
		const subscriberEmail = execution.delivery.notification.subscriber.email
		if (!subscriberEmail) throw new Error("Subscriber email is unavailable")
		await deliveryRepository.transition(workspaceId, deliveryId, "RUNNING", {
			provider: providerConfig.providerName,
		})

		// 1. Create DeliveryAttempt
		const attempt = await deliveryAttemptRepository.create({
			notificationId,
			channel: "EMAIL",
			deliveryId,
			provider: providerConfig.providerName,
			attemptNumber: job.attemptsMade + 1,
			status: "PENDING",
			enqueuedAt: new Date(),
		})
		await deliveryAttemptRepository.update(attempt.id, {
			status: "RUNNING",
			startedAt: new Date(),
		})

		try {
			// 2. Fetch correct provider implementation
			const emailProvider = providerFactory.getEmailProvider(
				providerConfig.providerName,
			)

			// 3. Send using Provider
			const result = await emailProvider.send({
				to: subscriberEmail,
				from: providerConfig.fromAddress,
				subject: renderedContent.subject,
				html: renderedContent.html,
				text: renderedContent.textBody || "",
				apiKey: providerConfig.apiKey,
				idempotencyKey: deliveryId,
			})

			// 4. Update status based on provider response
			if (result.success) {
				await deliveryAttemptRepository.update(attempt.id, {
					status: "SUCCESS",
					providerMessageId: result.messageId ?? null,
					providerResponse: { messageId: result.messageId },
					finishedAt: new Date(),
				})
				await deliveryRepository.transition(workspaceId, deliveryId, "SUCCESS", {
					providerMessageId: result.messageId ?? null,
					lastError: null,
				})
				await recomputeAggregateStatus(workspaceId, notificationId)
			} else {
				throw new EmailDeliveryError(
					result.error || "Provider delivery failed",
					result.retryable ?? false,
				)
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Unknown delivery error"
			const terminal =
					error instanceof EmailDeliveryError && !error.retryable
						? true
						: job.attemptsMade >=
					(job.opts.attempts || MAX_DELIVERY_ATTEMPTS) - 1
			const status = terminal ? "DLQ" : "FAILED"
			await deliveryAttemptRepository.update(attempt.id, {
				status,
				errorMessage,
				finishedAt: new Date(),
			})
			await deliveryRepository.transition(workspaceId, deliveryId, status, {
				lastError: errorMessage,
			})
			await recomputeAggregateStatus(workspaceId, notificationId)

			if (!terminal) throw error // Let BullMQ handle retry backoff
		}
	},
	{
		connection: getQueueConnection(),
		concurrency: 5,
	},
)

import { logger } from "@/infra/observability/logger.ts"

emailWorker.on("completed", (job) => {
	logger.info({ jobId: job.id }, "Email worker job completed")
})

emailWorker.on("failed", (job, err) => {
	logger.error(
		{ jobId: job?.id, err: err.message },
		"Email worker job failed",
	)
})
