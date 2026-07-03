import type {
	EmailProvider,
	SendEmailPayload,
	ProviderResponse,
} from "./email-provider.interface.ts"
import { Resend } from "resend"

export const resendProvider: EmailProvider = {
	async send(payload: SendEmailPayload): Promise<ProviderResponse> {
		try {
			const resend = new Resend(payload.apiKey)
			const { data, error } = await resend.emails.send({
				from: payload.from,
				to: payload.to,
				subject: payload.subject,
				html: payload.html,
				text: payload.text || "",
			})

			if (error) {
				return { success: false, error: error.message }
			}

			return { success: true, messageId: data?.id }
		} catch (err: any) {
			return { success: false, error: err.message }
		}
	},
}
