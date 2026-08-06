import { randomUUID } from "node:crypto"
import { Worker } from "bullmq"
import type { Job } from "bullmq"
import { getQueueConnection } from "../queues/queue.connection.ts"
import type { ProcessDigestJobDto } from "../queues/digest.queue.ts"
import { digestService } from "@/modules/notifications/digest.service.ts"
import { DigestJobSchema } from "../queues/payloads.ts"

export const digestWorker = new Worker(
	"digest-queue",
	async (job: Job<ProcessDigestJobDto>) => {
		const payload = DigestJobSchema.parse(job.data)
		await digestService.processBatch(
			payload.batchId,
			`digest-worker:${randomUUID()}`,
		)
	},
	{ connection: getQueueConnection(), concurrency: 5 },
)
