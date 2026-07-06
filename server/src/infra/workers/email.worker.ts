import { Worker } from "bullmq"
import type { Job } from "bullmq"
import { getQueueConnection } from "../queues/queue.connection.ts"
import type { SendEmailJobDto } from "../queues/email.queue.ts"
import { providerFactory } from "@/common/providers/email/provider.factory.ts"
import { notificationRepository } from "@/modules/notifications/notification.repository.ts"
import { deliveryAttemptRepository } from "@/modules/notifications/delivery-attempt.repository.ts"

export const emailWorker = new Worker(
	"email-queue",
	async (job: Job<SendEmailJobDto>) => {
		const {
			notificationId,
			workspaceId,
			subscriberEmail,
			renderedContent,
			providerConfig,
		} = job.data

		// 1. Create DeliveryAttempt
		const attempt = await deliveryAttemptRepository.create({
			notificationId,
			channel: "email",
			provider: providerConfig.providerName,
			attemptNumber: job.attemptsMade + 1,
			status: "PENDING",
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
				})
				await notificationRepository.updateStatus(
					notificationId,
					"DELIVERED",
				)
			} else {
				throw new Error(result.error || "Provider delivery failed")
			}
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "Unknown delivery error"
			await deliveryAttemptRepository.update(attempt.id, {
				status: "FAILED",
				errorMessage,
			})

			// If last attempt, mark notification as FAILED
			if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
				await notificationRepository.updateStatus(
					notificationId,
					"FAILED",
				)
			}

			throw error // Let BullMQ handle retry backoff
		}
	},
	{
		connection: getQueueConnection(),
		concurrency: 5,
	},
)

emailWorker.on("completed", (job) => {
	console.log(`[Email Worker] Job ${job.id} completed.`)
})

emailWorker.on("failed", (job, err) => {
	console.log(
		`[Email Worker] Job ${job?.id} failed with error: ${err.message}`,
	)
})
