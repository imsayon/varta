export const openApiSpec = {
	openapi: "3.0.3",
	info: {
		title: "Varta API",
		version: "1.0.0",
		description: "Varta notification API. Acceptance is durable intent; external delivery is asynchronous and may repeat after interruption.",
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
		"/workspaces/{workspaceId}/routing-rules/availability": {
			get: { summary: "Check optional AI rule authoring availability", security: [{ BearerAuth: [] }],
				parameters: [{ name: "workspaceId", in: "path", required: true, schema: { type: "string" } }],
				responses: { "200": { description: "Success envelope containing available and optional reason; no credentials are exposed" }, "403": { description: "Workspace access denied" } } },
		},
		"/workspaces/{workspaceId}/notifications/{notificationId}/retry": {
			post: { summary: "Resend a failed notification", description: "Compatibility route: creates a new notification and reserves another quota run. Automatic worker retries do not create a new charge. Current template content is used at execution.",
				security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
				parameters: ["workspaceId", "notificationId"].map(name => ({ name, in: "path", required: true, schema: { type: "string" } })),
				responses: { "202": { description: "New notification durably accepted" }, "400": { description: "Only failed notifications can be resent" }, "403": { description: "Workspace access or quota denied" } } },
		},
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
					"202": { description: "Notification and quota reservation committed; delivery is asynchronous" },
					"400": { description: "Invalid trigger payload" },
				},
			},
		},
	},
} as const
