export interface ProviderResponse {
	success: boolean
	messageId?: string
	error?: string
}

export interface SendEmailPayload {
	to: string
	from: string
	subject: string
	html: string
	text?: string
	apiKey: string
}

export interface EmailProvider {
	send(payload: SendEmailPayload): Promise<ProviderResponse>
}
