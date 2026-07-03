import { providerRepository } from "./provider.repository.ts"
import { encryptConfig } from "@/common/crypto.util.ts"
import { Prisma } from "@prisma/client"
import { providerFactory } from "@/common/providers/email/provider.factory.ts"

export const providerService = {
	async createConfig(workspaceId: string, channel: string, provider: string, config: Record<string, any>) {
		const encryptedConfig = encryptConfig(config)
		return providerRepository.create({
			workspaceId,
			channel,
			provider,
			config: encryptedConfig as any,
			isActive: true
		})
	},

	async updateConfig(workspaceId: string, channel: string, provider: string, config: Record<string, any>, isActive: boolean) {
		const encryptedConfig = encryptConfig(config)

		// Check if exists
		const existing = await providerRepository.findByWorkspaceAndChannel(workspaceId, channel)
		if (existing) {
			return providerRepository.update(workspaceId, channel, {
				provider,
				config: encryptedConfig as any,
				isActive
			})
		}
		
		return providerRepository.create({
			workspaceId,
			channel,
			provider,
			config: encryptedConfig as any,
			isActive
		})
	},

	async getProviderConfig(workspaceId: string, channel: string) {
		return providerRepository.findByWorkspaceAndChannel(workspaceId, channel)
	},

	async testProvider(providerName: string, config: any) {
		const emailProvider = providerFactory.getEmailProvider(providerName)
		return emailProvider.send({
			to: config.fromAddress,
			from: config.fromAddress,
			subject: "Varta Provider Test",
			html: "<h1>Varta Setup Successful!</h1><p>Your email provider is configured correctly.</p>",
			apiKey: config.apiKey
		})
	}
}
