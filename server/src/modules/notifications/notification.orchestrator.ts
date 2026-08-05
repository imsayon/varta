import type { TriggerNotificationRequest } from "./notification.schema.ts"
import { idempotencyService } from "@/infra/idempotency/idempotency.service.ts"
import { subscriberRepository } from "../subscribers/subscriber.repository.ts"
import { templateRepository } from "../templates/template.repository.ts"
import { notificationRepository } from "./notification.repository.ts"
import { queueService } from "@/infra/queues/queue.service.ts"
import { Prisma } from "@prisma/client"
import { NotFoundError } from "@/common/errors/app-error.ts"
import { sendTimeOptimizationService } from "@/modules/ai/send-time-optimization.service.ts"
import { logger } from "@/infra/observability/logger.ts"
import { deliveryPreparationService } from "./delivery-preparation.service.ts"
import { digestService } from "./digest.service.ts"
import { routingRuleService } from "../routing-rules/routing-rule.service.ts"
import { NotificationChannel } from "./notification.types.ts"

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
		const locked = await idempotencyService.acquireLock(
			workspaceId,
			idempotencyKey,
		)
		if (!locked) {
			const existing = await notificationRepository.findByIdempotencyKey(
				workspaceId,
				idempotencyKey,
			)
			return {
				success: true,
				accepted: true,
				message: "Duplicate request ignored.",
				notificationId: existing?.id,
				status: existing?.status,
			}
		}

		try {
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
			const rendered = await Promise.all(
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

			const notification = await notificationRepository.create({
				workspaceId,
				templateId: template.id,
				subscriberId: subscriber.id,
				idempotencyKey,
				triggerPayload: payload as Prisma.InputJsonValue,
				channels,
				status: "ENQUEUED",
				scheduledAt: options?.scheduledAt
					? new Date(options.scheduledAt)
					: null,
				priority: options?.priority ?? "NORMAL",
				smartTimingRequested: options?.smartTiming ?? false,
			})

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

			if (template.digestConfig) {
				await digestService.addNotificationToBatches({
					workspaceId,
					subscriberId: subscriber.id,
					templateId: template.id,
					notificationId: notification.id,
					channels: rendered,
					digestConfig: template.digestConfig,
				})
			} else {
				for (const delivery of rendered) {
					const deliveryId = crypto.randomUUID()
					if (delivery.channel === "EMAIL") {
						await queueService.enqueueEmail({
							notificationId: notification.id,
							deliveryId,
							workspaceId,
							subscriberEmail: subscriber.email ?? "",
							renderedContent: delivery.renderedContent,
							providerConfig: delivery.providerConfig,
							delayMs: sendDelayMs,
						})
					} else if (delivery.channel === "IN_APP") {
						await queueService.enqueueInApp({
							notificationId: notification.id,
							deliveryId,
							workspaceId,
							subscriberId: subscriber.id,
							renderedContent: delivery.renderedContent,
							delayMs: sendDelayMs,
						})
					} else {
						await queueService.enqueueWebhook({
							notificationId: notification.id,
							deliveryId,
							workspaceId,
							url: delivery.providerConfig.url,
							signingSecret:
								delivery.providerConfig.signingSecret,
							eventType: delivery.eventType,
							payload: delivery.payload,
							delayMs: sendDelayMs,
						})
					}
				}
			}

			return {
				notificationId: notification.id,
				status: "ENQUEUED",
				channels,
				scheduledAt: options?.scheduledAt ?? null,
				delayMs: sendDelayMs,
			}
		} catch (error) {
			await idempotencyService.releaseLock(workspaceId, idempotencyKey)
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "P2002"
			) {
				const existing =
					await notificationRepository.findByIdempotencyKey(
						workspaceId,
						idempotencyKey,
					)
				if (existing) {
					return {
						notificationId: existing.id,
						status: existing.status,
						channels: [],
						scheduledAt: null,
						delayMs: 0,
					}
				}
			}
			throw error
		}
	},
}
