import type { EmailProvider } from "./email-provider.interface.ts"
import { resendProvider } from "./resend.provider.ts"

export const providerFactory = {
	getEmailProvider(providerName: string): EmailProvider {
		switch (providerName.toLowerCase()) {
			case "resend":
				return resendProvider
			default:
				throw new Error(
					`Email provider ${providerName} is not supported.`,
				)
		}
	},
}
