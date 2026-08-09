import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

export interface SendWebhookJobDto {
	version: 1
	notificationId: string
	deliveryId: string
	workspaceId: string
	requestId?: string
	correlationId?: string
	traceparent?: string
}

export const webhookQueue = createQueue<SendWebhookJobDto>(QueueNames.WEBHOOK)
