declare global {
	namespace Express {
		interface Request {
			user?: {
				id: string
				sessionId: string
				workspaceId: string
			}
		}
	}
}

export {}
