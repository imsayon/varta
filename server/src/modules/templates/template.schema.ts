import { z } from "zod"

const channelContentSchema = z.object({
	email: z.object({
		subject: z.string(),
		htmlBody: z.string(),
		textBody: z.string().optional(),
	}).optional(),
	inapp: z.object({
		title: z.string(),
		body: z.string(),
		actionUrl: z.string().optional(),
		avatarUrl: z.string().optional(),
	}).optional(),
	webhook: z.object({
		eventType: z.string(),
		payload: z.record(z.unknown()).optional(),
	}).optional(),
})

export const createTemplateSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	channels: channelContentSchema,
	digestConfig: z.record(z.unknown()).nullable().optional(),
	aiPersonalize: z.boolean().default(false),
})

export const updateTemplateSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	channels: channelContentSchema.optional(),
	digestConfig: z.record(z.unknown()).nullable().optional(),
	aiPersonalize: z.boolean().optional(),
	isActive: z.boolean().optional(),
})

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
