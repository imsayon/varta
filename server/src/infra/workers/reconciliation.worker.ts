import { Worker } from "bullmq"
import { getQueueConnection, getQueuePrefix } from "@/infra/queues/queue.connection.ts"
import { createQueue } from "@/infra/queues/queue.factory.ts"
import { reconciliationService } from "@/modules/notifications/reconciliation.service.ts"
import { logger } from "@/infra/observability/logger.ts"

import { QueueNames } from "@/infra/queues/queue.constants.ts"
import { ReconciliationJobSchema } from "@/infra/queues/payloads.ts"

type ReconciliationJob = { version: 1 }

const reconciliationQueue = createQueue<ReconciliationJob>(
	QueueNames.RECONCILIATION,
)

export const reconciliationWorker = new Worker<ReconciliationJob>(
	"reconciliation-queue",
	async (job) => {
		ReconciliationJobSchema.parse(job.data)
		return reconciliationService.reconcileStuckNotifications()
	},
	{ connection: getQueueConnection(), prefix: getQueuePrefix() },
)

reconciliationWorker.on("failed", (job, error) =>
	logger.error({ jobId: job?.id, err: error }, "Reconciliation job failed"),
)

export async function startWorkerModule(): Promise<void> {
	await reconciliationQueue.upsertJobScheduler(
		"reconciliation-periodic",
		{ every: 300_000 },
		{ name: "periodic", data: { version: 1 } },
	)
}
