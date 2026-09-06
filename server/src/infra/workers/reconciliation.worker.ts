import { createWorker } from "@/infra/queues/queue.factory.ts"
import { reconciliationService } from "@/modules/notifications/reconciliation.service.ts"
import { logger } from "@/infra/observability/logger.ts"

import { reconciliationQueue } from "@/infra/queues/queues.ts"
import { QueueNames } from "@/infra/queues/queue.constants.ts"
import {
	ReconciliationJobSchema,
	type ReconciliationJob,
} from "@/infra/queues/payloads.ts"

export const worker = createWorker<ReconciliationJob>(
	QueueNames.RECONCILIATION,
	async (job) => {
		ReconciliationJobSchema.parse(job.data)
		return reconciliationService.reconcileStuckNotifications()
	},
)

worker.on("failed", (job, error) =>
	logger.error({ jobId: job?.id, err: error }, "Reconciliation job failed"),
)

export async function start(): Promise<void> {
	await reconciliationQueue.upsertJobScheduler(
		"reconciliation-periodic",
		{ every: 300_000 },
		{ name: "periodic", data: { version: 1 } },
	)
}
