import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

// Shape of the data payload for each email delivery job
export interface SendEmailJobDto {
	notificationId: string
	deliveryId: string
	workspaceId: string
	subscriberEmail: string
	renderedContent: {
		subject: string
		html: string
		textBody?: string
	}
	providerConfig: {
		providerName: string
		apiKey: string
		fromAddress: string
	}
	delayMs?: number
}

// The email delivery queue — consumed by the email worker
export const emailQueue = createQueue<SendEmailJobDto>(QueueNames.EMAIL)
