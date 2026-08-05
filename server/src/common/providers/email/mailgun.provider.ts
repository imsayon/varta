import type {
	EmailProvider,
	SendEmailPayload,
	ProviderResponse,
} from "./email-provider.interface.ts"

export const mailgunProvider: EmailProvider = {
	async send(payload: SendEmailPayload): Promise<ProviderResponse> {
		try {
			const domain = payload.from.split("@")[1] || "mg.varta.dev"
			const auth = Buffer.from(`api:${payload.apiKey}`).toString("base64")

			const body = new URLSearchParams()
			body.append("from", payload.from)
			body.append("to", payload.to)
			body.append("subject", payload.subject)
			body.append("html", payload.html)
			if (payload.text) body.append("text", payload.text)

			const response = await fetch(
				`https://api.mailgun.net/v3/${domain}/messages`,
				{
					method: "POST",
					headers: {
						Authorization: `Basic ${auth}`,
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: body.toString(),
				},
			)

			if (!response.ok) {
				const errorText = await response.text()
				return { success: false, error: `Mailgun error: ${errorText}` }
			}

			const data = (await response.json()) as { id?: string }
			return { success: true, messageId: data.id || crypto.randomUUID() }
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Unknown Mailgun error"
			return { success: false, error: message }
		}
	},
}
