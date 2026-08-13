export class AIProviderError extends Error {
	readonly category: string
	readonly statusCode: number | undefined

	constructor(message: string, category: string, statusCode?: number) {
		super(message)
		this.name = "AIProviderError"
		this.category = category
		this.statusCode = statusCode
	}
}
