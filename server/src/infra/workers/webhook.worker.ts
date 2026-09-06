import { createHash } from "node:crypto"
import { createWorker } from "../queues/queue.factory.ts"
import { QueueNames } from "../queues/queue.constants.ts"
import { SendWebhookJobSchema, type DeliveryJob } from "../queues/payloads.ts"
import { executeDelivery } from "@/modules/notifications/delivery-execution.service.ts"
import { NotificationChannel } from "@/modules/notifications/notification.types.ts"
import { createWebhookSignature, postSafeWebhook } from "@/modules/providers/webhook.util.ts"

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
			[
				"ECONNRESET",
				"ECONNREFUSED",
				"ETIMEDOUT",
				"EAI_AGAIN",
				"ENETUNREACH",
				"EHOSTUNREACH",
			].includes(code))
	)
}

export const worker = createWorker<DeliveryJob>(QueueNames.WEBHOOK, async (job) => {
	const payload = SendWebhookJobSchema.parse(job.data)
	await executeDelivery(payload, NotificationChannel.WEBHOOK, async ({ prepared }) => {
		if (prepared.channel !== "WEBHOOK") throw new Error("Expected webhook delivery")
		const { providerConfig, eventType } = prepared
		const body = JSON.stringify({ specVersion: "1.0", eventType, deliveryId: payload.deliveryId, data: prepared.payload })
		const timestamp = Math.floor(Date.now() / 1000)
		try {
			const response = await postSafeWebhook(providerConfig.url, body, {
				"content-type": "application/json", "x-varta-version": "1", "x-varta-event": eventType,
				"x-varta-delivery-id": payload.deliveryId, "idempotency-key": payload.deliveryId,
				"x-varta-signature": `t=${timestamp},v1=${createWebhookSignature(timestamp, body, providerConfig.signingSecret)}`,
			}, REQUEST_TIMEOUT_MS, MAX_RESPONSE_BYTES)
			return { success: response.status >= 200 && response.status < 300, provider: "webhook",
				retryable: isRetryableStatus(response.status), error: `Webhook responded with HTTP ${response.status}`,
				response: { status: response.status, bodyBytes: Buffer.byteLength(response.body),
					bodySha256: createHash("sha256").update(response.body).digest("hex") } }
		} catch (error) {
			return { success: false, provider: "webhook", retryable: isRetryableError(error) || error instanceof TypeError,
				error: error instanceof Error ? error.message : "Webhook delivery failed" }
		}
	})
}, { concurrency: 10 })
