import { randomUUID } from "node:crypto"
import { createWorker } from "../queues/queue.factory.ts"
import { QueueNames } from "../queues/queue.constants.ts"
import { digestService } from "@/modules/notifications/digest.service.ts"
import { DigestJobSchema } from "../queues/payloads.ts"
import type { Job } from "bullmq"
import type { DigestJob } from "../queues/payloads.ts"

export const worker = createWorker<DigestJob>(
	QueueNames.DIGEST,
	async (job: Job<DigestJob>) => {
		const payload = DigestJobSchema.parse(job.data)
		await digestService.processBatch(
			payload.batchId,
			`digest-worker:${randomUUID()}`,
		)
	},
	{ concurrency: 5 },
)
