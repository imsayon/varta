import type { TriggerNotificationRequest } from "./notification.schema.ts"
import { subscriberRepository } from "../subscribers/subscriber.repository.ts"
import { templateRepository } from "../templates/template.repository.ts"
import { NotFoundError } from "@/common/errors/app-error.ts"
import { deliveryPreparationService } from "./delivery-preparation.service.ts"
import { routingRuleService } from "../routing-rules/routing-rule.service.ts"
import { NotificationChannel } from "./notification.types.ts"
import { acceptNotification, type AcceptanceResult } from "./notification-acceptance.service.ts"
import { digestService } from "./digest.service.ts"
import { notificationRepository } from "./notification.repository.ts"
import { notificationAcceptance } from "@/infra/observability/metrics.ts"

function normalizeChannels(
	channels: string[] | undefined,
): NotificationChannel[] {
	const resolved = (channels?.length ? channels : ["EMAIL"]).map((channel) =>
		channel.toUpperCase(),
	) as NotificationChannel[]
	return [...new Set(resolved)]
}

function triggerResponse({ notification, created }: AcceptanceResult) {
	return {
		notificationId: notification.id,
		status: notification.status,
		channels: notification.channels,
		scheduledAt: notification.scheduledAt?.toISOString() ?? null,
		delayMs: notification.scheduledAt ? Math.max(0, notification.scheduledAt.getTime() - Date.now()) : 0,
		duplicate: !created,
	}
}

export const notificationOrchestrator = {
	async triggerNotification(
		workspaceId: string,
		idempotencyKey: string,
		request: TriggerNotificationRequest,
	) {
		const existing = await notificationRepository.findByIdempotencyKey(workspaceId, idempotencyKey)
		if (existing) {
			notificationAcceptance.inc({ outcome: "duplicate" })
			return triggerResponse({ created: false, notification: existing })
		}
		const { templateId, subscriberExternalId, payload, options } = request
		{
			const template = await templateRepository.findById(
				workspaceId,
				templateId,
			)
			if (!template) throw new NotFoundError("Template not found.")
			const subscriber = await subscriberRepository.findByExternalId(
				workspaceId,
				subscriberExternalId,
			)
			if (!subscriber) throw new NotFoundError("Subscriber not found.")

			const channels = await routingRuleService.resolveChannels(
				workspaceId,
				subscriber,
				template.channels,
				options?.channels
					? normalizeChannels(options.channels)
					: undefined,
			)
			await Promise.all(
				channels.map((channel) =>
					deliveryPreparationService.prepare(
						workspaceId,
						channel,
						template.channels,
						subscriber as unknown as Record<string, unknown>,
						payload,
					),
				),
			)

			const scheduledAt = options?.scheduledAt
				? new Date(options.scheduledAt)
				: null
			const acceptance = template.digestConfig
				? await digestService.acceptNotification({
					workspaceId,
					templateId: template.id,
					subscriberId: subscriber.id,
					idempotencyKey,
					payload,
					channels,
					priority: options?.priority ?? "NORMAL",
					digestConfig: template.digestConfig,
				})
				: await acceptNotification({
				workspaceId,
				templateId: template.id,
				subscriberId: subscriber.id,
				idempotencyKey,
				payload,
				channels,
				priority: options?.priority ?? "NORMAL",
				scheduledAt,
				smartTimingRequested: options?.smartTiming ?? false,
				})

			return triggerResponse(acceptance)
		}
	},
}
