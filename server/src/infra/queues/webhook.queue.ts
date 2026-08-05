import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

export interface SendWebhookJobDto {
	notificationId: string
	deliveryId: string
	workspaceId: string
	url: string
	signingSecret: string
	eventType: string
	payload: Record<string, unknown>
	delayMs?: number
}

export const webhookQueue = createQueue<SendWebhookJobDto>(QueueNames.WEBHOOK)
