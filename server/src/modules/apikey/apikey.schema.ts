import { z } from "zod"

export const createApiKeySchema = z.object({
	name: z
		.string()
		.trim()
		.min(3, "API key name must be at least 3 characters")
		.max(100),

	workspaceId: z.uuid(),
	expiresAt: z.coerce.date().optional(),
})

export const updateApiKeySchema = z
	.object({
		name: z.string().trim().min(3).max(100).optional(),
		isActive: z.boolean().optional(),
		expiresAt: z.coerce.date().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be updated",
	})

export const apiKeyParamsSchema = z.object({
	apiKeyId: z.uuid(),
})

export const apiKeyQuerySchema = z.object({
	workspaceId: z.uuid(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(10),
})

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>
export type ApiKeyParams = z.infer<typeof apiKeyParamsSchema>
export type ApiKeyQuery = z.infer<typeof apiKeyQuerySchema>
