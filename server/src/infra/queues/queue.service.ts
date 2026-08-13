import { emailQueue } from "./email.queue.ts"
import type { SendEmailJobDto } from "./email.queue.ts"
import { webhookQueue } from "./webhook.queue.ts"
import type { SendWebhookJobDto } from "./webhook.queue.ts"
import { inAppQueue } from "./inapp.queue.ts"
import type { SendInAppJobDto } from "./inapp.queue.ts"
import { digestQueue } from "./digest.queue.ts"
import type { ProcessDigestJobDto } from "./digest.queue.ts"
import { billingQueue, type BillingWebhookJobDto } from "./billing.queue.ts"

export const queueService = {
	async enqueueEmail(jobData: SendEmailJobDto) {
		await emailQueue.add("deliver", jobData, {
			jobId: `delivery-${jobData.deliveryId}`,
		})
	},
	async enqueueWebhook(jobData: SendWebhookJobDto) {
		await webhookQueue.add("deliver", jobData, {
			jobId: `delivery-${jobData.deliveryId}`,
		})
	},
	async enqueueInApp(jobData: SendInAppJobDto) {
		await inAppQueue.add("deliver", jobData, {
			jobId: `delivery-${jobData.deliveryId}`,
		})
	},
	async enqueueDigest(jobData: ProcessDigestJobDto, delayMs: number) {
		const jobId = `digest-${jobData.batchId}`
		const existing = await digestQueue.getJob(jobId)
		if (existing) {
			const state = await existing.getState()
			if (state === "failed") {
				await existing.retry("failed")
				return
			}
			if (["active", "waiting", "delayed", "prioritized"].includes(state)) return
			await existing.remove()
		}
		await digestQueue.add("process", jobData, {
			jobId,
			delay: Math.max(0, delayMs),
		})
	},
	async enqueueBillingWebhook(jobData: Extract<BillingWebhookJobDto, { kind: "event" }>, delayMs = 0) {
		const jobId = `billing-webhook-${jobData.inboxRecordId}`
		const existing = await billingQueue.getJob(jobId)
		if (existing) {
			const state = await existing.getState()
			if (["active", "waiting", "delayed", "prioritized"].includes(state)) return
			if (state === "failed") {
				await existing.retry("failed")
				return
			}
			await existing.remove()
		}
		await billingQueue.add("process", jobData, { jobId, delay: Math.max(0, delayMs) })
	},
	async replayDelivery(jobData: SendEmailJobDto, channel: string) {
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
			if (["active", "waiting", "delayed", "prioritized"].includes(state)) {
				return false
			}
			await existing.remove()
		}
		await queue.add("deliver", jobData, { jobId })
		return true
	},
}
