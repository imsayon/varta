import { Worker } from "bullmq"
import type { Job } from "bullmq"
import { createHash } from "node:crypto"
import { getQueueConnection, getQueuePrefix } from "../queues/queue.connection.ts"
import type { SendWebhookJobDto } from "../queues/webhook.queue.ts"
import { SendWebhookJobSchema } from "../queues/payloads.ts"
import { deliveryAttemptRepository } from "@/modules/notifications/delivery-attempt.repository.ts"
import { recomputeAggregateStatus } from "@/modules/notifications/notification-status.service.ts"
import { prepareDeliveryExecution } from "@/modules/notifications/delivery-execution.service.ts"
import { deliveryRepository } from "@/modules/notifications/delivery.repository.ts"
import {
	createWebhookSignature,
	postSafeWebhook,
} from "@/modules/providers/webhook.util.ts"
import { withRemoteTrace, withTrace } from "@/infra/observability/tracing.ts"
import { compactLogIdentifiers, withLogContext } from "@/infra/observability/log-context.ts"
import { logger, logEvent } from "@/infra/observability/logger.ts"
import { providerDuration, providerRequests } from "@/infra/observability/metrics.ts"

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
	const code =
		error && typeof error === "object" && "code" in error
			? String(error.code)
			: ""
	return (
		error instanceof Error &&
		(error.name === "AbortError" ||
			error.name === "RetryableWebhookError" ||
			error.message === "Webhook request timed out" ||
			["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH"].includes(code))
	)
}

export const webhookWorker = new Worker(
	"webhook-queue",
	async (job: Job<SendWebhookJobDto>) => {
		return withLogContext(compactLogIdentifiers({
			requestId: job.data.requestId,
			correlationId: job.data.correlationId,
			notificationId: job.data.notificationId,
			deliveryId: job.data.deliveryId,
			jobId: String(job.id ?? "unknown"),
		}), () => withRemoteTrace(job.data.traceparent, "worker.webhook", { "messaging.destination.name": "webhook-queue" }, async () => {
		const jobPayload = SendWebhookJobSchema.parse(job.data)
		const { notificationId, deliveryId, workspaceId } = jobPayload
		const execution = await prepareDeliveryExecution(workspaceId, deliveryId)
		if (execution.prepared.channel !== "WEBHOOK") {
			throw new Error("Webhook job references a non-webhook delivery")
		}
		const { eventType, payload, providerConfig } = execution.prepared
		const attemptNumber = job.attemptsMade + 1
		const startedAt = new Date()
		await deliveryRepository.transition(workspaceId, deliveryId, "RUNNING", {
			provider: "webhook",
		})
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
		logger.info(
			logEvent("provider", "provider.delivery.started", { attemptId: attempt.id }),
			"Outbound webhook attempt started",
		)

		try {
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
				providerConfig.signingSecret,
			)
			const response = await withTrace("provider.webhook.send", {
				"server.address": new URL(providerConfig.url).hostname,
				"messaging.destination.name": "webhook",
			}, () => postSafeWebhook(
				providerConfig.url,
				body,
				{
						"content-type": "application/json",
						"x-varta-version": "1",
						"x-varta-event": eventType,
						"x-varta-delivery-id": deliveryId,
						"x-varta-signature": `t=${timestamp},v1=${signature}`,
						"idempotency-key": deliveryId,
				},
				REQUEST_TIMEOUT_MS,
				MAX_RESPONSE_BYTES,
			))
			const providerResponse = {
				status: response.status,
				bodyBytes: Buffer.byteLength(response.body),
				bodySha256: createHash("sha256").update(response.body).digest("hex"),
			}
			if (response.status >= 200 && response.status < 300) {
				providerRequests.inc({ provider: "webhook", channel: "webhook", outcome: "success" })
				providerDuration.observe({ provider: "webhook", channel: "webhook" }, (Date.now() - startedAt.getTime()) / 1_000)
				await deliveryAttemptRepository.update(attempt.id, {
					status: "SUCCESS",
					providerResponse,
					finishedAt: new Date(),
					durationMs: Date.now() - startedAt.getTime(),
				})
				await deliveryRepository.transition(workspaceId, deliveryId, "SUCCESS", {
					lastError: null,
				})
				await recomputeAggregateStatus(workspaceId, notificationId)
				return
			}

			const retryable = isRetryableStatus(response.status)
			if (retryable)
				throw new RetryableWebhookError(
					`Retryable webhook response: ${response.status}`,
				)
			const errorMessage = `Webhook responded with HTTP ${response.status}`
			await deliveryAttemptRepository.update(attempt.id, {
				status: "DLQ",
				providerResponse,
				errorMessage,
				finishedAt: new Date(),
				durationMs: Date.now() - startedAt.getTime(),
			})
			await deliveryRepository.transition(workspaceId, deliveryId, "DLQ", {
				lastError: errorMessage,
			})
			await recomputeAggregateStatus(workspaceId, notificationId)
		} catch (error: unknown) {
			providerRequests.inc({ provider: "webhook", channel: "webhook", outcome: "failed" })
			providerDuration.observe({ provider: "webhook", channel: "webhook" }, (Date.now() - startedAt.getTime()) / 1_000)
			const retryable =
				isRetryableError(error) || error instanceof TypeError
			const terminal =
				!retryable || attemptNumber >= (job.opts.attempts ?? 5)
			const errorMessage =
				error instanceof Error ? error.message : "Webhook delivery failed"
			await deliveryAttemptRepository.update(attempt.id, {
				status: terminal ? "DLQ" : "FAILED",
				errorMessage,
				finishedAt: new Date(),
				durationMs: Date.now() - startedAt.getTime(),
			})
			await deliveryRepository.transition(
				workspaceId,
				deliveryId,
				terminal ? "DLQ" : "FAILED",
				{ lastError: errorMessage },
			)
			await recomputeAggregateStatus(workspaceId, notificationId)
			if (!retryable || terminal) return
			throw error
		}
		}))
	},
	{ connection: getQueueConnection(), prefix: getQueuePrefix(), concurrency: 10 },
)
