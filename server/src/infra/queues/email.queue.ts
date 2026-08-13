import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

// Shape of the data payload for each email delivery job
export interface SendEmailJobDto {
	version: 1
	notificationId: string
	deliveryId: string
	workspaceId: string
	requestId?: string
	correlationId?: string
	traceparent?: string
}

// The email delivery queue — consumed by the email worker
export const emailQueue = createQueue<SendEmailJobDto>(QueueNames.EMAIL)
