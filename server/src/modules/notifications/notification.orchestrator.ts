import type { TriggerNotificationRequest } from "./notification.schema.ts"
import { subscriberRepository } from "../subscribers/subscriber.repository.ts"
import { templateRepository } from "../templates/template.repository.ts"
import { NotFoundError } from "@/common/errors/app-error.ts"
import { sendTimeOptimizationService } from "@/modules/ai/send-time-optimization.service.ts"
import { logger } from "@/infra/observability/logger.ts"
import { deliveryPreparationService } from "./delivery-preparation.service.ts"
import { routingRuleService } from "../routing-rules/routing-rule.service.ts"
import { NotificationChannel } from "./notification.types.ts"
import { acceptNotification } from "./notification-acceptance.service.ts"
import { digestService } from "./digest.service.ts"

function normalizeChannels(
	channels: string[] | undefined,
): NotificationChannel[] {
	const resolved = (channels?.length ? channels : ["EMAIL"]).map((channel) =>
		channel.toUpperCase(),
	) as NotificationChannel[]
	return [...new Set(resolved)]
}

export const notificationOrchestrator = {
	async triggerNotification(
		workspaceId: string,
		idempotencyKey: string,
		request: TriggerNotificationRequest,
	) {
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

			let sendDelayMs = 0
			if (options?.scheduledAt) {
				const scheduledTime = new Date(options.scheduledAt).getTime()
				sendDelayMs = Math.max(0, scheduledTime - Date.now())
			} else if (options?.smartTiming) {
				try {
					sendDelayMs = await sendTimeOptimizationService.getDelay(
						workspaceId,
						subscriber.id,
						subscriber.timezone ?? "UTC",
					)
				} catch (error) {
					logger.warn(
						{
							err: error,
							workspaceId,
							subscriberId: subscriber.id,
						},
						"STO lookup failed; sending immediately",
					)
				}
			}

			const scheduledAt = options?.scheduledAt
				? new Date(options.scheduledAt)
				: sendDelayMs > 0
					? new Date(Date.now() + sendDelayMs)
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

			return {
				notificationId: acceptance.notification.id,
				status: acceptance.notification.status,
				channels: acceptance.notification.channels,
				scheduledAt: scheduledAt?.toISOString() ?? null,
				delayMs: sendDelayMs,
				duplicate: !acceptance.created,
			}
		}
	},
}
