import type { TriggerNotificationRequest } from "./notification.schema.ts"
import { idempotencyService } from "@/infra/idempotency/idempotency.service.ts"
import { subscriberRepository } from "../subscribers/subscriber.repository.ts"
import { templateRepository } from "../templates/template.repository.ts"
import { notificationRepository } from "./notification.repository.ts"
import { providerService } from "../providers/provider.service.ts"
import { queueService } from "@/common/services/queue.service.ts"
import { templateRendererService } from "@/common/template-engine/template-renderer.service.ts"
import { Prisma } from "@prisma/client"
import { decryptConfig } from "@/common/crypto.util.ts"

export const notificationOrchestrator = {
	async triggerNotification(
		workspaceId: string,
		idempotencyKey: string,
		request: TriggerNotificationRequest,
	) {
		const { templateId, subscriberExternalId, payload, options } = request

		// 1. Idempotency

		const locked = await idempotencyService.acquireLock(
			workspaceId,
			idempotencyKey,
		)

		if (!locked) {
			return {
				success: true,
				accepted: true,
				message: "Duplicate request ignored.",
			}
		}

		// 2. Resolve Template

		const template = await templateRepository.findById(
			workspaceId,
			templateId,
		)

		if (!template) {
			throw new Error("Template not found.")
		}

		// 3. Resolve Subscriber

		const subscriber = await subscriberRepository.findByExternalId(
			workspaceId,
			subscriberExternalId,
		)

		if (!subscriber) {
			throw new Error("Subscriber not found.")
		}

		// 4. Resolve Provider

		const provider = await providerService.getProviderConfig(
			workspaceId,
			"email",
		)

		if (!provider?.config) {
			throw new Error("Email provider not configured.")
		}

		const config = decryptConfig(provider.config as Record<string, unknown>) as {
			apiKey: string
			fromAddress: string
		}

		// 5. Render Template

		const emailTemplate = (template.channels as any)?.email

		if (!emailTemplate) {
			throw new Error("Email channel missing.")
		}

		const renderContext = {
			...payload,
			subscriber,
		}

		const renderedContent = {
			subject: templateRendererService.renderAndSanitize(
				emailTemplate.subject,
				renderContext,
			),

			html: templateRendererService.renderAndSanitize(
				emailTemplate.htmlBody,
				renderContext,
			),

			textBody: templateRendererService.renderAndSanitize(
				emailTemplate.textBody,
				renderContext,
			),
		}

		// 6. Persist Notification

		const notification = await notificationRepository.create({
			workspaceId,
			templateId: template.id,
			subscriberId: subscriber.id,
			idempotencyKey,
			triggerPayload: payload as Prisma.InputJsonValue,
			channels: options?.channels ?? ["EMAIL"],
			status: "ENQUEUED",
			scheduledAt: options?.scheduledAt
				? new Date(options.scheduledAt)
				: null,
			priority: options?.priority ?? "NORMAL",
		})

		// 7. Queue Job

		await queueService.enqueueEmail({
			notificationId: notification.id,
			workspaceId,
			subscriberEmail: subscriber.email ?? "",
			renderedContent,
			providerConfig: {
				apiKey: config.apiKey,
				fromAddress: config.fromAddress,
				providerName: provider.provider,
			},
		})

		return {
			notificationId: notification.id,
			status: "ENQUEUED",
			channels: options?.channels ?? ["EMAIL"],
			scheduledAt: options?.scheduledAt ?? null,
		}
	},
}
