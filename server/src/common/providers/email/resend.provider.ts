import type {
	EmailProvider,
	SendEmailPayload,
	ProviderResponse,
} from "./email-provider.interface.ts"
const REQUEST_TIMEOUT_MS = 10_000

export const resendProvider: EmailProvider = {
	async send(payload: SendEmailPayload): Promise<ProviderResponse> {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
		try {
			const response = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					authorization: `Bearer ${payload.apiKey}`,
					"content-type": "application/json",
					"idempotency-key": payload.idempotencyKey,
				},
				body: JSON.stringify({
					from: payload.from,
					to: [payload.to],
					subject: payload.subject,
					html: payload.html,
					text: payload.text || "",
				}),
				signal: controller.signal,
			})
			const data = (await response.json().catch(() => null)) as {
				id?: unknown
				message?: unknown
			} | null
			if (!response.ok) {
				return {
					success: false,
					error: `Resend rejected the request with HTTP ${response.status}`,
					retryable: response.status === 408 || response.status === 429 || response.status >= 500,
				}
			}
			if (typeof data?.id !== "string" || !data.id) {
				return { success: false, error: "Resend response did not include a message ID", retryable: true }
			}
			return { success: true, messageId: data.id }
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Unknown Resend error"
			return { success: false, error: message.slice(0, 500), retryable: true }
		} finally {
			clearTimeout(timeout)
		}
	},
}
