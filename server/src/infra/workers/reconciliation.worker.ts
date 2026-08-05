import { Worker } from "bullmq"
import { getQueueConnection } from "@/infra/queues/queue.connection.ts"
import { createQueue } from "@/infra/queues/queue.factory.ts"
import { reconciliationService } from "@/modules/notifications/reconciliation.service.ts"
import { logger } from "@/infra/observability/logger.ts"

import { QueueNames } from "@/infra/queues/queue.constants.ts"

const reconciliationQueue = createQueue<{ run: boolean }>(
	QueueNames.RECONCILIATION,
)

export const reconciliationWorker = new Worker(
	"reconciliation-queue",
	async () => reconciliationService.reconcileStuckNotifications(),
	{ connection: getQueueConnection() },
)

reconciliationWorker.on("failed", (job, error) =>
	logger.error({ jobId: job?.id, err: error }, "Reconciliation job failed"),
)

// Schedule recurring 5-minute reconciliation task
void reconciliationQueue
	.add("periodic", { run: true }, {
		jobId: "reconciliation:periodic",
		repeat: { every: 300_000 },
	} as unknown as import("bullmq").JobsOptions)
	.catch((err) =>
		logger.error({ err }, "Failed to schedule reconciliation worker"),
	)
