import { z } from "zod"
import { jsonObjectSchema } from "@/common/types/json.ts"

export const createTemplateSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().optional(),
	channels: jsonObjectSchema,
	digestConfig: jsonObjectSchema.optional().nullable(),
	aiPersonalize: z.boolean().optional(),
	isActive: z.boolean().optional(),
})

export const updateTemplateSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().optional(),
	channels: jsonObjectSchema.optional(),
	digestConfig: jsonObjectSchema.optional().nullable(),
	aiPersonalize: z.boolean().optional(),
	isActive: z.boolean().optional(),
})

export const previewTemplateSchema = z.object({
	content: z.string(),
	payload: jsonObjectSchema,
})
