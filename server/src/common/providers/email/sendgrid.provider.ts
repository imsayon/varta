import type {
	EmailProvider,
	SendEmailPayload,
	ProviderResponse,
} from "./email-provider.interface.ts"

export const sendgridProvider: EmailProvider = {
	async send(payload: SendEmailPayload): Promise<ProviderResponse> {
		try {
			const response = await fetch(
				"https://api.sendgrid.com/v3/mail/send",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${payload.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						personalizations: [{ to: [{ email: payload.to }] }],
						from: { email: payload.from },
						subject: payload.subject,
						content: [
							{ type: "text/html", value: payload.html },
							...(payload.text
								? [{ type: "text/plain", value: payload.text }]
								: []),
						],
					}),
				},
			)

			if (!response.ok) {
				const errorText = await response.text()
				return { success: false, error: `SendGrid error: ${errorText}` }
			}

			const messageId =
				response.headers.get("x-message-id") || crypto.randomUUID()
			return { success: true, messageId }
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Unknown SendGrid error"
			return { success: false, error: message }
		}
	},
}
