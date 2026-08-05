import type { EmailProvider } from "./email-provider.interface.ts"
import { resendProvider } from "./resend.provider.ts"
import { sendgridProvider } from "./sendgrid.provider.ts"
import { mailgunProvider } from "./mailgun.provider.ts"
import { sesProvider } from "./ses.provider.ts"

export const providerFactory = {
	getEmailProvider(providerName: string): EmailProvider {
		switch (providerName.toLowerCase()) {
			case "resend":
				return resendProvider
			case "sendgrid":
				return sendgridProvider
			case "mailgun":
				return mailgunProvider
			case "ses":
			case "aws-ses":
				return sesProvider
			default:
				throw new Error(
					`Email provider ${providerName} is not supported.`,
				)
		}
	},
}
