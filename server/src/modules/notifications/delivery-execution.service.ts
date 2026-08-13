import { NotFoundError } from "@/common/errors/app-error.ts"
import { deliveryRepository } from "./delivery.repository.ts"
import { deliveryPreparationService } from "./delivery-preparation.service.ts"
import { NotificationChannel } from "./notification.types.ts"

export async function prepareDeliveryExecution(
	workspaceId: string,
	deliveryId: string,
) {
	const delivery = await deliveryRepository.findForExecution(
		workspaceId,
		deliveryId,
	)
	if (!delivery) throw new NotFoundError("Delivery not found")
	const channel = delivery.channel as NotificationChannel
	if (!Object.values(NotificationChannel).includes(channel)) {
		throw new Error(`Unsupported delivery channel: ${delivery.channel}`)
	}
	const triggerPayload =
		(delivery.notification.triggerPayload as Record<string, unknown>) ?? {}
	const digestItems = Array.isArray(triggerPayload.digestItems)
		? triggerPayload.digestItems
		: undefined
	const prepared = await deliveryPreparationService.prepare(
		workspaceId,
		channel,
		delivery.notification.template.channels,
		delivery.notification.subscriber as unknown as Record<string, unknown>,
		triggerPayload,
		digestItems,
	)
	return { delivery, prepared }
}
