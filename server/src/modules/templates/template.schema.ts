import { z } from "zod"

export const createTemplateSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().optional(),
	channels: z.record(z.string(), z.any()),
	digestConfig: z.record(z.string(), z.any()).optional().nullable(),
	aiPersonalize: z.boolean().optional(),
	isActive: z.boolean().optional(),
})

export const updateTemplateSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().optional(),
	channels: z.record(z.string(), z.any()).optional(),
	digestConfig: z.record(z.string(), z.any()).optional().nullable(),
	aiPersonalize: z.boolean().optional(),
	isActive: z.boolean().optional(),
})

export const previewTemplateSchema = z.object({
	content: z.string(),
	payload: z.record(z.string(), z.any()),
})
