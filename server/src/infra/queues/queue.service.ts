import {
	billingQueue,
	digestQueue,
	emailQueue,
	inAppQueue,
	webhookQueue,
} from "./queues.ts"
import type { BillingWebhookJob, DeliveryJob, DigestJob } from "./payloads.ts"

export const queueService = {
	async enqueueEmail(jobData: DeliveryJob) {
		await emailQueue.add("deliver", jobData, {
			jobId: `delivery-${jobData.deliveryId}`,
		})
	},
	async enqueueWebhook(jobData: DeliveryJob) {
		await webhookQueue.add("deliver", jobData, {
			jobId: `delivery-${jobData.deliveryId}`,
		})
	},
	async enqueueInApp(jobData: DeliveryJob) {
		await inAppQueue.add("deliver", jobData, {
			jobId: `delivery-${jobData.deliveryId}`,
		})
	},
	async enqueueDigest(jobData: DigestJob, delayMs: number) {
		const jobId = `digest-${jobData.batchId}`
		const existing = await digestQueue.getJob(jobId)
		if (existing) {
			const state = await existing.getState()
			if (state === "failed") {
				await existing.retry("failed")
				return
			}
			if (["active", "waiting", "delayed", "prioritized"].includes(state))
				return
			await existing.remove()
		}
		await digestQueue.add("process", jobData, {
			jobId,
			delay: Math.max(0, delayMs),
		})
	},
	async enqueueBillingWebhook(
		jobData: Extract<BillingWebhookJob, { kind: "event" }>,
		delayMs = 0,
	) {
		const jobId = `billing-webhook-${jobData.inboxRecordId}`
		const existing = await billingQueue.getJob(jobId)
		if (existing) {
			const state = await existing.getState()
			if (["active", "waiting", "delayed", "prioritized"].includes(state))
				return
			if (state === "failed") {
				await existing.retry("failed")
				return
			}
			await existing.remove()
		}
		await billingQueue.add("process", jobData, {
			jobId,
			delay: Math.max(0, delayMs),
		})
	},
	async replayDelivery(jobData: DeliveryJob, channel: string) {
		const queue =
			channel === "EMAIL"
				? emailQueue
				: channel === "IN_APP"
					? inAppQueue
					: channel === "WEBHOOK"
						? webhookQueue
						: null
		if (!queue) throw new Error(`Unsupported delivery channel: ${channel}`)
		const jobId = `delivery-${jobData.deliveryId}`
		const existing = await queue.getJob(jobId)
		if (existing) {
			const state = await existing.getState()
			if (state === "failed") {
				await existing.retry("failed")
				return true
			}
			if (["active", "waiting", "delayed", "prioritized"].includes(state))
				return false

			await existing.remove()
		}
		await queue.add("deliver", jobData, { jobId })
		return true
	},
}
