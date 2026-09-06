import { createWorker } from "@/infra/queues/queue.factory.ts"
import { billingQueue } from "@/infra/queues/queues.ts"
import { QueueNames } from "@/infra/queues/queue.constants.ts"
import {
	BillingWebhookJobSchema,
	type BillingWebhookJob,
} from "@/infra/queues/payloads.ts"
import { billingService } from "@/modules/billing/billing.service.ts"
import { logger } from "@/infra/observability/logger.ts"

export const worker = createWorker<BillingWebhookJob>(
	QueueNames.BILLING,
	async (job) => {
		const payload = BillingWebhookJobSchema.parse(job.data)
		if (payload.kind === "recover") {
			await billingService.recoverPendingWebhookEvents()
			return
		}
		await billingService.processWebhookEvent(payload.inboxRecordId)
	},
	{ concurrency: 2 },
)

worker.on("failed", (job, error) =>
	logger.error({ jobId: job?.id, err: error }, "Billing webhook job failed"),
)

export async function start(): Promise<void> {
	await billingQueue.upsertJobScheduler(
		"billing-inbox-recovery",
		{ every: 60_000 },
		{ name: "recover", data: { version: 1, kind: "recover" } },
	)
}
