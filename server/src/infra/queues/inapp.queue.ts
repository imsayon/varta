import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

export interface SendInAppJobDto {
	version: 1
	notificationId: string
	deliveryId: string
	workspaceId: string
}

export const inAppQueue = createQueue<SendInAppJobDto>(QueueNames.INAPP)
