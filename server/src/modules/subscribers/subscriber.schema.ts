import { z } from "zod"

export const createSubscriberSchema = z.object({
	externalId: z.string().min(1).max(255),
	email: z.string().email().optional(),
	name: z.string().max(200).optional(),
	timezone: z.string().default("UTC"),
	locale: z.string().max(10).default("en"),
	attributes: z.record(z.string(), z.unknown()).default({}),
	preferences: z.record(z.string(), z.boolean()).default({}),
})

export const updateSubscriberSchema = z.object({
	email: z.string().email().optional(),
	name: z.string().max(200).optional(),
	timezone: z.string().optional(),
	locale: z.string().max(10).optional(),
	attributes: z.record(z.string(), z.unknown()).optional(),
	preferences: z.record(z.string(), z.boolean()).optional(),
})

export type CreateSubscriberInput = z.infer<typeof createSubscriberSchema>
export type UpdateSubscriberInput = z.infer<typeof updateSubscriberSchema>
