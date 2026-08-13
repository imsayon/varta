import { Worker } from "bullmq"
import { getQueueConnection, getQueuePrefix } from "@/infra/queues/queue.connection.ts"
import { billingQueue, type BillingWebhookJobDto } from "@/infra/queues/billing.queue.ts"
import { BillingWebhookJobSchema } from "@/infra/queues/payloads.ts"
import { billingService } from "@/modules/billing/billing.service.ts"
import { logger } from "@/infra/observability/logger.ts"

export const billingWorker = new Worker<BillingWebhookJobDto>(
	"billing-queue",
	async (job) => {
		const payload = BillingWebhookJobSchema.parse(job.data)
		if (payload.kind === "recover") {
			await billingService.recoverPendingWebhookEvents()
			return
		}
		await billingService.processWebhookEvent(payload.inboxRecordId)
	},
	{ connection: getQueueConnection(), prefix: getQueuePrefix(), concurrency: 2 },
)

billingWorker.on("failed", (job, error) =>
	logger.error({ jobId: job?.id, err: error }, "Billing webhook job failed"),
)

export async function startWorkerModule(): Promise<void> {
	await billingQueue.upsertJobScheduler(
		"billing-inbox-recovery",
		{ every: 60_000 },
		{ name: "recover", data: { version: 1, kind: "recover" } },
	)
}
