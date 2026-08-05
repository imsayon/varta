import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

export interface SendInAppJobDto {
	notificationId: string
	deliveryId: string
	workspaceId: string
	subscriberId: string
	renderedContent: Record<string, unknown>
	delayMs?: number
}

export const inAppQueue = createQueue<SendInAppJobDto>(QueueNames.INAPP)
