import { emailQueue } from "./email.queue.ts"
import type { SendEmailJobDto } from "./email.queue.ts"
import { webhookQueue } from "./webhook.queue.ts"
import type { SendWebhookJobDto } from "./webhook.queue.ts"
import { inAppQueue } from "./inapp.queue.ts"
import type { SendInAppJobDto } from "./inapp.queue.ts"
import { digestQueue } from "./digest.queue.ts"
import type { ProcessDigestJobDto } from "./digest.queue.ts"

export const queueService = {
	async enqueueEmail(jobData: SendEmailJobDto) {
		await emailQueue.add("deliver", jobData, {
			jobId: `not_${jobData.notificationId}:email`,
			delay: jobData.delayMs ?? 0,
		})
	},
	async enqueueWebhook(jobData: SendWebhookJobDto) {
		await webhookQueue.add("deliver", jobData, {
			jobId: `not_${jobData.notificationId}:webhook`,
			delay: jobData.delayMs ?? 0,
		})
	},
	async enqueueInApp(jobData: SendInAppJobDto) {
		await inAppQueue.add("deliver", jobData, {
			jobId: `not_${jobData.notificationId}:inapp`,
			delay: jobData.delayMs ?? 0,
		})
	},
	async enqueueDigest(jobData: ProcessDigestJobDto, delayMs: number) {
		await digestQueue.add("process", jobData, {
			jobId: `digest:${jobData.batchId}`,
			delay: Math.max(0, delayMs),
		})
	},
}
