import { providerRepository } from "./provider.repository.ts"
import { encryptConfig } from "@/common/utils/crypto.util.ts"
import type { Prisma } from "@prisma/client"
import { providerFactory } from "@/common/providers/email/provider.factory.ts"
import { assertSafeWebhookUrl } from "./webhook.util.ts"
import { BadRequestError } from "@/common/errors/app-error.ts"

interface ProviderConfigInput {
	apiKey?: string
	fromAddress?: string
	[key: string]: unknown
}

export const providerService = {
	async createConfig(
		workspaceId: string,
		channel: string,
		provider: string,
		config: ProviderConfigInput,
	) {
		const encryptedConfig = encryptConfig(config)
		return providerRepository.create({
			workspaceId,
			channel,
			provider,
			config: encryptedConfig as Prisma.InputJsonValue,
			isActive: true,
		})
	},

	async updateConfig(
		workspaceId: string,
		channel: string,
		provider: string,
		config: ProviderConfigInput,
		isActive: boolean,
	) {
		if (channel.toUpperCase() === "WEBHOOK") {
			if (
				provider !== "webhook" ||
				typeof config.url !== "string" ||
				typeof config.signingSecret !== "string"
			) {
				throw new BadRequestError(
					"Webhook provider requires url and signingSecret",
				)
			}
			await assertSafeWebhookUrl(config.url)
			if (config.signingSecret.length < 16) {
				throw new BadRequestError(
					"Webhook signingSecret must be at least 16 characters",
				)
			}
		}
		const encryptedConfig = encryptConfig(config)

		const existing = await providerRepository.findByWorkspaceAndChannel(
			workspaceId,
			channel,
		)
		if (existing) {
			return providerRepository.update(workspaceId, channel, {
				provider,
				config: encryptedConfig as Prisma.InputJsonValue,
				isActive,
			})
		}

		return providerRepository.create({
			workspaceId,
			channel,
			provider,
			config: encryptedConfig as Prisma.InputJsonValue,
			isActive,
		})
	},

	async getProviderConfig(workspaceId: string, channel: string) {
		return providerRepository.findByWorkspaceAndChannel(
			workspaceId,
			channel,
		)
	},

	async listProviderConfigs(workspaceId: string) {
		return providerRepository.findManyByWorkspace(workspaceId)
	},

	async testProvider(
		providerName: string,
		config: ProviderConfigInput,
		targetToAddress?: string,
	) {
		const emailProvider = providerFactory.getEmailProvider(providerName)
		return emailProvider.send({
			to:
				targetToAddress ||
				(config.toAddress as string) ||
				config.fromAddress ||
				"",
			from: config.fromAddress ?? "",
			subject: "Varta Provider Test",
			html: "<h1>Varta Setup Successful!</h1><p>Your email provider is configured correctly.</p>",
			apiKey: config.apiKey ?? "",
		})
	},
}
