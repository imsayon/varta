import { withRemoteTrace } from "@/infra/observability/tracing.ts"
import { withLogContext, compactLogIdentifiers } from "@/infra/observability/log-context.ts"
import { MAX_DELIVERY_ATTEMPTS } from "@/infra/queues/queue.options.ts"
import { recomputeAggregateStatus } from "./notification-status.service.ts"
import { logger } from "@/infra/observability/logger.ts"
import { deliveryAttempts, deliveryDuration, boundedProviderLabel, providerRequests, providerDuration } from "@/infra/observability/metrics.ts"
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

export type DeliveryOutcome = {
	success: boolean
	provider: string
	retryable?: boolean
	error?: string
	messageId?: string
	response?: import("@prisma/client").Prisma.InputJsonValue | undefined
}

// All channel workers use the same durable claim and fenced outcome transaction.
export async function executeDelivery(
	payload: import("@/infra/queues/payloads.ts").DeliveryJob,
	channel: NotificationChannel,
	send: (execution: Awaited<ReturnType<typeof prepareDeliveryExecution>>) => Promise<DeliveryOutcome>,
) {
	return withLogContext(compactLogIdentifiers(payload), () => withRemoteTrace(payload.traceparent, `worker.${channel.toLowerCase()}`, { "messaging.destination.name": channel }, async () => {
		const claim = await deliveryRepository.claim(payload.workspaceId, payload.deliveryId)
		if (!claim) {
			await recomputeAggregateStatus(payload.workspaceId, payload.notificationId)
			return
		}
		const startedAt = Date.now()
		let outcome: DeliveryOutcome
		try {
			const execution = await prepareDeliveryExecution(payload.workspaceId, payload.deliveryId)
			if (execution.prepared.channel !== channel) throw new Error("Job channel does not match delivery")
			outcome = await send(execution)
		} catch (error) {
			outcome = { success: false, provider: channel.toLowerCase(), retryable: true,
				error: error instanceof Error ? error.message : "Delivery failed" }
		}
		const status = outcome.success ? "SUCCESS" :
			outcome.retryable && claim.attempt.attemptNumber < MAX_DELIVERY_ATTEMPTS ? "FAILED" : "DLQ"
		const durationMs = Date.now() - startedAt
		const saved = await deliveryRepository.finish(payload.workspaceId, payload.deliveryId, claim.owner, claim.attempt.id, status, {
			provider: outcome.provider, providerMessageId: outcome.messageId,
			providerResponse: outcome.response, errorMessage: outcome.success ? undefined : (outcome.error ?? "Provider delivery failed").slice(0, 1000), durationMs,
		})
		if (!saved) {
			logger.warn({ deliveryId: payload.deliveryId, attemptId: claim.attempt.id }, "Discarded result from expired delivery owner")
			return
		}
		deliveryAttempts.inc({ channel, outcome: status })
		deliveryDuration.observe({ channel }, durationMs / 1000)
		const labels = { provider: boundedProviderLabel(outcome.provider), channel: channel === "IN_APP" ? "in_app" : channel.toLowerCase() }
		providerRequests.inc({ ...labels, outcome: outcome.success ? "success" : "failed" })
		providerDuration.observe(labels, durationMs / 1000)
		logger.info({ notificationId: payload.notificationId, deliveryId: payload.deliveryId, attemptId: claim.attempt.id, status }, "Delivery outcome persisted")
		await recomputeAggregateStatus(payload.workspaceId, payload.notificationId)
		if (status === "FAILED") throw new Error(outcome.error ?? "Retryable delivery failure")
	}))
}
