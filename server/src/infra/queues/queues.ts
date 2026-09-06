import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"
import type {
	BillingWebhookJob,
	DeliveryJob,
	DigestJob,
	OutboxTickJob,
	ReconciliationJob,
} from "./payloads.ts"

export const emailQueue = createQueue<DeliveryJob>(QueueNames.EMAIL)
export const inAppQueue = createQueue<DeliveryJob>(QueueNames.INAPP)
export const webhookQueue = createQueue<DeliveryJob>(QueueNames.WEBHOOK)
export const digestQueue = createQueue<DigestJob>(QueueNames.DIGEST)
export const outboxQueue = createQueue<OutboxTickJob>(QueueNames.OUTBOX)
export const billingQueue = createQueue<BillingWebhookJob>(QueueNames.BILLING)
export const reconciliationQueue = createQueue<ReconciliationJob>(
	QueueNames.RECONCILIATION,
)
