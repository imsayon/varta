declare global {
	namespace Express {
		/** Augmented by Passport (id only) and JWT middleware (id + sessionId + workspaceId). */
		interface User {
			id: string
			sessionId?: string
			workspaceId?: string
		}
		interface Request {
			apiKey?: {
				id: string
				workspaceId: string
			}
		}
	}
}

export {}
