export class AppError extends Error {
	constructor(
		message: string,
		public statusCode: number,
	) {
		super(message)
		this.name = this.constructor.name
	}
}

export class NotFoundError extends AppError {
	constructor(message = "Resource not found") {
		super(message, 404)
	}
}

export class ConflictError extends AppError {
	constructor(message = "Conflict") {
		super(message, 409)
	}
}
