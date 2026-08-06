export interface ProviderResponse {
	success: boolean
	messageId?: string
	error?: string
	retryable?: boolean
}

export interface SendEmailPayload {
	to: string
	from: string
	subject: string
	html: string
	text?: string
	apiKey: string
	idempotencyKey: string
}

export interface EmailProvider {
	send(payload: SendEmailPayload): Promise<ProviderResponse>
}
