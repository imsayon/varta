import type { Job } from "bullmq"
import { createWorker } from "@/infra/queues/queue.factory.ts"
import { outboxQueue } from "@/infra/queues/queues.ts"
import { QueueNames } from "@/infra/queues/queue.constants.ts"
import { dispatchOutboxBatch } from "@/modules/notifications/outbox-dispatcher.service.ts"
import {
	OutboxTickJobSchema,
	type OutboxTickJob,
} from "@/infra/queues/payloads.ts"

export const worker = createWorker<OutboxTickJob>(
	QueueNames.OUTBOX,
	async (job: Job<OutboxTickJob>) => {
		OutboxTickJobSchema.parse(job.data)
		return dispatchOutboxBatch()
	},
	{ concurrency: 1 },
)

export async function start(): Promise<void> {
	await outboxQueue.upsertJobScheduler(
		"outbox-dispatch",
		{ every: 1_000 },
		{ name: "dispatch", data: { version: 1 } },
	)
}
