import { z } from "zod"
import { jsonObjectSchema } from "@/common/types/json.ts"

export const createSubscriberSchema = z.object({
	externalId: z.string().min(1).max(255),
	email: z.string().email().optional(),
	name: z.string().max(100).optional(),
	timezone: z.string().max(50).optional(),
	locale: z.string().max(10).optional(),
	attributes: jsonObjectSchema.optional(),
	preferences: jsonObjectSchema.optional(),
})

export const updateSubscriberSchema = z.object({
	email: z.string().email().optional(),
	name: z.string().max(100).optional(),
	timezone: z.string().max(50).optional(),
	locale: z.string().max(10).optional(),
	attributes: jsonObjectSchema.optional(),
	preferences: jsonObjectSchema.optional(),
})

export const listSubscribersQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
})
