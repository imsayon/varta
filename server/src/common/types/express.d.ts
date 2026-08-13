declare global {
	namespace Express {
		interface Request {
			capability?: import("@/common/auth/principal.ts").AuthorizationCapability
			oauthUser?: { id: string }
			rawBody?: Buffer
		}
	}
}

export {}
