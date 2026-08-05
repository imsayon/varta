import { randomUUID } from "node:crypto"
import { Worker } from "bullmq"
import type { Job } from "bullmq"
import { getQueueConnection } from "../queues/queue.connection.ts"
import type { ProcessDigestJobDto } from "../queues/digest.queue.ts"
import { digestService } from "@/modules/notifications/digest.service.ts"

export const digestWorker = new Worker(
	"digest-queue",
	async (job: Job<ProcessDigestJobDto>) => {
		await digestService.processBatch(
			job.data.batchId,
			`digest-worker:${randomUUID()}`,
		)
	},
	{ connection: getQueueConnection(), concurrency: 5 },
)
