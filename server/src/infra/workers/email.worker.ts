import { createWorker } from "../queues/queue.factory.ts"
import { QueueNames } from "../queues/queue.constants.ts"
import { SendEmailJobSchema, type DeliveryJob } from "../queues/payloads.ts"
import { providerFactory } from "@/common/providers/email/provider.factory.ts"
import { executeDelivery } from "@/modules/notifications/delivery-execution.service.ts"
import { NotificationChannel } from "@/modules/notifications/notification.types.ts"

export const worker = createWorker<DeliveryJob>(QueueNames.EMAIL, async (job) => {
	const payload = SendEmailJobSchema.parse(job.data)
	await executeDelivery(payload, NotificationChannel.EMAIL, async ({ delivery, prepared }) => {
		if (prepared.channel !== "EMAIL") throw new Error("Expected email delivery")
		const to = delivery.notification.subscriber.email
		if (!to) return { success: false, provider: "resend", error: "Subscriber email is unavailable" }
		const { providerConfig, renderedContent } = prepared
		const result = await providerFactory.getEmailProvider(providerConfig.providerName).send({
			to, from: providerConfig.fromAddress, subject: renderedContent.subject,
			html: renderedContent.html, text: renderedContent.textBody ?? "",
			apiKey: providerConfig.apiKey, idempotencyKey: payload.deliveryId,
		})
		return { ...result, provider: providerConfig.providerName,
			response: result.messageId ? { messageId: result.messageId } : undefined }
	})
}, { concurrency: 5 })
