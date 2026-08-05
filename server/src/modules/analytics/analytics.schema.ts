import { z } from "zod"

export const analyticsQuerySchema = z.object({
	from: z.iso.datetime(),
	to: z.iso.datetime(),
	granularity: z.enum(["hour", "day"]).default("day"),
	limit: z.coerce.number().int().min(1).max(100).default(10),
})

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
