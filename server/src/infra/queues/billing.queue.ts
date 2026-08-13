import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

export type BillingWebhookJobDto =
	| { version: 1; kind: "event"; inboxRecordId: string }
	| { version: 1; kind: "recover" }

export const billingQueue = createQueue<BillingWebhookJobDto>(QueueNames.BILLING)
