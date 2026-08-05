import { Worker } from "bullmq"
import type { Job } from "bullmq"
import { getQueueConnection } from "../queues/queue.connection.ts"
import type { SendWebhookJobDto } from "../queues/webhook.queue.ts"
import { deliveryAttemptRepository } from "@/modules/notifications/delivery-attempt.repository.ts"
import { recomputeAggregateStatus } from "@/modules/notifications/notification-status.service.ts"
import {
	assertSafeWebhookUrl,
	createWebhookSignature,
} from "@/modules/providers/webhook.util.ts"

const REQUEST_TIMEOUT_MS = 5_000
const MAX_RESPONSE_BYTES = 64 * 1024

function isRetryableStatus(status: number): boolean {
	return status === 408 || status === 429 || status >= 500
}

class RetryableWebhookError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "RetryableWebhookError"
	}
}

function isRetryableError(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error.name === "AbortError" || error.name === "RetryableWebhookError")
	)
}

export const webhookWorker = new Worker(
	"webhook-queue",
	async (job: Job<SendWebhookJobDto>) => {
		const {
			notificationId,
			deliveryId,
			eventType,
			payload,
			signingSecret,
		} = job.data
		const attemptNumber = job.attemptsMade + 1
		const startedAt = new Date()
		const attempt = await deliveryAttemptRepository.create({
			notificationId,
			channel: "WEBHOOK",
			deliveryId,
			attemptNumber,
			provider: "webhook",
			status: "RUNNING",
			startedAt,
			enqueuedAt: startedAt,
		})

		try {
			const { url } = await assertSafeWebhookUrl(job.data.url)
			const body = JSON.stringify({
				specVersion: "1.0",
				eventType,
				deliveryId,
				data: payload,
			})
			const timestamp = Math.floor(Date.now() / 1000)
			const signature = createWebhookSignature(
				timestamp,
				body,
				signingSecret,
			)
			const controller = new AbortController()
			const timeout = setTimeout(
				() => controller.abort(),
				REQUEST_TIMEOUT_MS,
			)

			let response: Response
			try {
				response = await fetch(url, {
					method: "POST",
					headers: {
						"content-type": "application/json",
						"x-varta-version": "1",
						"x-varta-event": eventType,
						"x-varta-delivery-id": deliveryId,
						"x-varta-signature": `t=${timestamp},v1=${signature}`,
						"idempotency-key": deliveryId,
					},
					body,
					redirect: "error",
					signal: controller.signal,
				})
			} finally {
				clearTimeout(timeout)
			}

			const responseText = await response.text()
			const providerResponse = {
				status: response.status,
				body: responseText.slice(0, MAX_RESPONSE_BYTES),
			}
			if (response.ok) {
				await deliveryAttemptRepository.update(attempt.id, {
					status: "SUCCESS",
					providerResponse,
					finishedAt: new Date(),
					durationMs: Date.now() - startedAt.getTime(),
				})
				await recomputeAggregateStatus(notificationId)
				return
			}

			const retryable = isRetryableStatus(response.status)
			const terminal =
				!retryable || attemptNumber >= (job.opts.attempts ?? 5)
			await deliveryAttemptRepository.update(attempt.id, {
				status: terminal ? "DLQ" : "FAILED",
				providerResponse,
				errorMessage: `Webhook responded with HTTP ${response.status}`,
				finishedAt: new Date(),
				durationMs: Date.now() - startedAt.getTime(),
			})
			await recomputeAggregateStatus(notificationId)
			if (retryable)
				throw new RetryableWebhookError(
					`Retryable webhook response: ${response.status}`,
				)
		} catch (error: unknown) {
			const retryable =
				isRetryableError(error) || error instanceof TypeError
			const terminal =
				!retryable || attemptNumber >= (job.opts.attempts ?? 5)
			await deliveryAttemptRepository.update(attempt.id, {
				status: terminal ? "DLQ" : "FAILED",
				errorMessage:
					error instanceof Error
						? error.message
						: "Webhook delivery failed",
				finishedAt: new Date(),
				durationMs: Date.now() - startedAt.getTime(),
			})
			await recomputeAggregateStatus(notificationId)
			if (!retryable || terminal) return
			throw error
		}
	},
	{ connection: getQueueConnection(), concurrency: 10 },
)
