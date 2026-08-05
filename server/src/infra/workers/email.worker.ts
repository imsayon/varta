import { Worker } from "bullmq"
import type { Job } from "bullmq"
import { getQueueConnection } from "../queues/queue.connection.ts"
import { MAX_DELIVERY_ATTEMPTS } from "../queues/queue.options.ts"
import type { SendEmailJobDto } from "../queues/email.queue.ts"
import { SendEmailJobSchema } from "../queues/payloads.ts"
import { providerFactory } from "@/common/providers/email/provider.factory.ts"
import { deliveryAttemptRepository } from "@/modules/notifications/delivery-attempt.repository.ts"
import { recomputeAggregateStatus } from "@/modules/notifications/notification-status.service.ts"

export const emailWorker = new Worker(
	"email-queue",
	async (job: Job<SendEmailJobDto>) => {
		const payloadData = SendEmailJobSchema.parse(job.data)
		const {
			notificationId,
			deliveryId,
			subscriberEmail,
			renderedContent,
			providerConfig,
		} = payloadData

		// 1. Create DeliveryAttempt
		const attempt = await deliveryAttemptRepository.create({
			notificationId,
			channel: "email",
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
			})

			// 4. Update status based on provider response
			if (result.success) {
				await deliveryAttemptRepository.update(attempt.id, {
					status: "SUCCESS",
					providerResponse: { messageId: result.messageId },
					finishedAt: new Date(),
				})
				await recomputeAggregateStatus(notificationId)
			} else {
				throw new Error(result.error || "Provider delivery failed")
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Unknown delivery error"
			await deliveryAttemptRepository.update(attempt.id, {
				status:
					job.attemptsMade >=
					(job.opts.attempts || MAX_DELIVERY_ATTEMPTS) - 1
						? "DLQ"
						: "FAILED",
				errorMessage,
				finishedAt: new Date(),
			})
			await recomputeAggregateStatus(notificationId)

			throw error // Let BullMQ handle retry backoff
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
