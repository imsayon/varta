import { Worker, type Job } from "bullmq"
import { getQueueConnection } from "@/infra/queues/queue.connection.ts"
import { QueueNames } from "@/infra/queues/queue.constants.ts"
import { outboxQueue } from "@/infra/queues/outbox.queue.ts"
import { dispatchOutboxBatch } from "@/modules/notifications/outbox-dispatcher.service.ts"
import { OutboxTickJobSchema } from "@/infra/queues/payloads.ts"
import type { OutboxTickJob } from "@/infra/queues/outbox.queue.ts"

export const outboxWorker = new Worker(
	QueueNames.OUTBOX,
	async (job: Job<OutboxTickJob>) => {
		OutboxTickJobSchema.parse(job.data)
		return dispatchOutboxBatch()
	},
	{ connection: getQueueConnection(), concurrency: 1 },
)

export async function startWorkerModule(): Promise<void> {
	await outboxQueue.upsertJobScheduler(
		"outbox-dispatch",
		{ every: 1_000 },
		{ name: "dispatch", data: { version: 1 } },
	)
}
