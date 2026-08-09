import { z } from "zod"

export const analyticsQuerySchema = z.object({
	from: z.iso.datetime().optional(),
	to: z.iso.datetime().optional(),
	timeRange: z.enum(["7d", "30d", "90d"]).optional(),
	granularity: z.enum(["hour", "day"]).default("day"),
	limit: z.coerce.number().int().min(1).max(100).default(10),
}).transform((data, context) => {
	const now = new Date()
	const toDate = data.to ? new Date(data.to) : now

	let fromDate: Date
	if (data.from) {
		fromDate = new Date(data.from)
	} else if (data.timeRange === "7d") {
		fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000)
	} else if (data.timeRange === "90d") {
		fromDate = new Date(toDate.getTime() - 90 * 24 * 60 * 60 * 1000)
	} else {
		fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000)
	}

	if (fromDate >= toDate || toDate.getTime() - fromDate.getTime() > 90 * 24 * 60 * 60 * 1000) {
		context.addIssue({ code: "custom", message: "Analytics range must be positive and no longer than 90 days" })
		return z.NEVER
	}

	return {
		from: fromDate,
		to: toDate,
		granularity: data.granularity,
		limit: data.limit,
		timeRange: data.timeRange,
	}
})

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
