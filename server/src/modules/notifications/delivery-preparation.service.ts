import { decryptConfig } from "@/common/utils/crypto.util.ts"
import { templateRendererService } from "@/common/template-engine/template-renderer.service.ts"
import { providerService } from "@/modules/providers/provider.service.ts"
import type { Prisma } from "@prisma/client"
import { BadRequestError } from "@/common/errors/app-error.ts"

export type DeliveryChannel = "EMAIL" | "IN_APP" | "WEBHOOK"

export type RenderContext = {
	subscriber: Record<string, unknown>
	[key: string]: unknown
}

export type PreparedDelivery =
	| {
			channel: "EMAIL"
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
	  }
	| {
			channel: "IN_APP"
			renderedContent: Record<string, unknown>
	  }
	| {
			channel: "WEBHOOK"
			eventType: string
			payload: Record<string, unknown>
			providerConfig: { url: string; signingSecret: string }
	  }

function renderJson(value: unknown, context: RenderContext): unknown {
	if (typeof value === "string") {
		return templateRendererService.render(
			templateRendererService.compile(value),
			context,
		)
	}
	if (Array.isArray(value))
		return value.map((item) => renderJson(item, context))
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				renderJson(item, context),
			]),
		)
	}
	return value
}

function asObject(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}
}

export const deliveryPreparationService = {
	async prepare(
		workspaceId: string,
		channel: DeliveryChannel,
		templateChannels: unknown,
		subscriber: Record<string, unknown>,
		payload: Record<string, unknown>,
		items?: unknown[],
	): Promise<PreparedDelivery> {
		const channels = asObject(templateChannels)
		const context: RenderContext = {
			...payload,
			subscriber,
			items: items ?? [],
			digest: Boolean(items),
		}
		const channelKey = channel.toLowerCase()
		const channelTemplate = asObject(channels[channelKey])

		if (channel === "EMAIL") {
			const provider = await providerService.getProviderConfig(
				workspaceId,
				"email",
			)
			const config = provider?.config
				? (decryptConfig(
						provider.config as Record<string, unknown>,
					) as Record<string, unknown>)
				: null
			if (!provider?.isActive || !config?.apiKey || !config.fromAddress) {
				throw new BadRequestError("Email provider is not configured.")
			}
			const subject = channelTemplate.subject
			const htmlBody = channelTemplate.htmlBody
			if (typeof subject !== "string" || typeof htmlBody !== "string") {
				throw new BadRequestError(
					"Email channel requires subject and htmlBody.",
				)
			}
			return {
				channel,
				renderedContent: {
					subject: templateRendererService.renderAndSanitize(
						subject,
						context,
					),
					html: templateRendererService.renderAndSanitize(
						htmlBody,
						context,
					),
					textBody:
						typeof channelTemplate.textBody === "string"
							? templateRendererService.renderAndSanitize(
									channelTemplate.textBody,
									context,
								)
							: "",
				},
				providerConfig: {
					providerName: provider.provider,
					apiKey: String(config.apiKey),
					fromAddress: String(config.fromAddress),
				},
			}
		}

		if (channel === "IN_APP") {
			const title = channelTemplate.title
			const body = channelTemplate.body
			if (typeof title !== "string" || typeof body !== "string") {
				throw new BadRequestError(
					"In-app channel requires title and body.",
				)
			}
			return {
				channel,
				renderedContent: {
					title: templateRendererService.renderAndSanitize(
						title,
						context,
					),
					body: templateRendererService.renderAndSanitize(
						body,
						context,
					),
					actionUrl:
						typeof channelTemplate.actionUrl === "string"
							? templateRendererService.render(
									templateRendererService.compile(
										channelTemplate.actionUrl,
									),
									context,
								)
							: undefined,
					avatarUrl:
						typeof channelTemplate.avatarUrl === "string"
							? templateRendererService.render(
									templateRendererService.compile(
										channelTemplate.avatarUrl,
									),
									context,
								)
							: undefined,
				},
			}
		}

		const provider = await providerService.getProviderConfig(
			workspaceId,
			"webhook",
		)
		const config = provider?.config
			? (decryptConfig(
					provider.config as Record<string, unknown>,
				) as Record<string, unknown>)
			: null
		if (
			!provider?.isActive ||
			typeof config?.url !== "string" ||
			typeof config.signingSecret !== "string"
		) {
			throw new BadRequestError("Webhook provider is not configured.")
		}
		const eventType = channelTemplate.eventType
		if (typeof eventType !== "string" || !eventType) {
			throw new BadRequestError("Webhook channel requires eventType.")
		}
		return {
			channel,
			eventType: templateRendererService.render(
				templateRendererService.compile(eventType),
				context,
			),
			payload: asObject(renderJson(channelTemplate.payload, context)),
			providerConfig: {
				url: config.url,
				signingSecret: config.signingSecret,
			},
		}
	},

	toJson(value: unknown): Prisma.InputJsonValue {
		return value as Prisma.InputJsonValue
	},
}
