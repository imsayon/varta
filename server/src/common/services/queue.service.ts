import { emailQueue } from "../../infra/queues/email.queue.ts"
import type { SendEmailJobDto } from "../../infra/queues/email.queue.ts"

export const queueService = {
	async enqueueEmail(jobData: SendEmailJobDto) {
		await emailQueue.add("deliver", jobData, {
			jobId: `not_${jobData.notificationId}:email`,
		})
	},
}
