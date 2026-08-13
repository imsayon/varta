export const openApiSpec = {
	openapi: "3.0.3",
	info: {
		title: "Varta API",
		version: "0.0.0",
		description: "Production Notification Platform API",
	},
	servers: [
		{
			url: "/api/v1",
			description: "Varta Production API v1",
		},
	],
	components: {
		securitySchemes: {
			BearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
			},
			ApiKeyAuth: {
				type: "apiKey",
				in: "header",
				name: "x-api-key",
			},
		},
		schemas: {
			ApiSuccessEnvelope: {
				type: "object",
				required: ["success", "data", "meta"],
				properties: {
					success: { type: "boolean", example: true },
					data: { type: "object" },
					meta: {
						type: "object",
						properties: {
							requestId: { type: "string" },
							cursor: { type: "string", nullable: true },
							hasMore: { type: "boolean" },
							total: { type: "integer" },
						},
					},
				},
			},
			ApiErrorEnvelope: {
				type: "object",
				required: ["success", "error", "meta"],
				properties: {
					success: { type: "boolean", example: false },
					error: {
						type: "object",
						required: ["code", "message"],
						properties: {
							code: { type: "string", example: "VALIDATION_ERROR" },
							message: { type: "string" },
							details: { type: "object" },
						},
					},
					meta: {
						type: "object",
						properties: {
							requestId: { type: "string" },
						},
					},
				},
			},
			User: {
				type: "object",
				properties: {
					id: { type: "string" },
					email: { type: "string" },
					name: { type: "string", nullable: true },
					emailVerified: { type: "boolean" },
					createdAt: { type: "string", format: "date-time" },
				},
			},
			Subscriber: {
				type: "object",
				properties: {
					id: { type: "string" },
					workspaceId: { type: "string" },
					externalId: { type: "string" },
					email: { type: "string", nullable: true },
					name: { type: "string", nullable: true },
					timezone: { type: "string" },
					locale: { type: "string" },
					attributes: { type: "object" },
					preferences: { type: "object" },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			Template: {
				type: "object",
				properties: {
					id: { type: "string" },
					workspaceId: { type: "string" },
					name: { type: "string" },
					description: { type: "string", nullable: true },
					channels: { type: "object" },
					digestConfig: { type: "object", nullable: true },
					aiPersonalize: { type: "boolean" },
					isActive: { type: "boolean" },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			RoutingRule: {
				type: "object",
				properties: {
					id: { type: "string" },
					workspaceId: { type: "string" },
					name: { type: "string" },
					naturalLanguage: { type: "string", nullable: true },
					ruleAst: { type: "object" },
					priority: { type: "integer" },
					isActive: { type: "boolean" },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			Notification: {
				type: "object",
				properties: {
					id: { type: "string" },
					workspaceId: { type: "string" },
					templateId: { type: "string" },
					subscriberId: { type: "string" },
					idempotencyKey: { type: "string" },
					triggerPayload: { type: "object" },
					channels: { type: "array", items: { type: "string" } },
					status: {
						type: "string",
						enum: ["PENDING", "ENQUEUED", "PARTIAL", "DELIVERED", "FAILED"],
					},
					priority: {
						type: "string",
						enum: ["LOW", "NORMAL", "HIGH"],
					},
					scheduledAt: { type: "string", format: "date-time", nullable: true },
					triggeredAt: { type: "string", format: "date-time" },
					createdAt: { type: "string", format: "date-time" },
				},
			},
		},
	},
	paths: {
		"/auth/login": {
			post: {
				summary: "Authenticate user and return JWT access token",
				responses: {
					"200": { description: "Login successful" },
					"401": { description: "Invalid credentials" },
				},
			},
		},
		"/auth/register": {
			post: {
				summary: "Register new user account",
				responses: {
					"201": { description: "User registered" },
				},
			},
		},
		"/workspaces/{workspaceId}/notifications/trigger": {
			post: {
				summary: "Trigger a notification delivery pipeline run",
				responses: {
					"200": { description: "Notification accepted" },
					"400": { description: "Invalid trigger payload" },
				},
			},
		},
	},
} as const
