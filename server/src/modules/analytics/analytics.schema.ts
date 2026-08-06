import { z } from "zod"

export const analyticsQuerySchema = z.object({
	from: z.string().optional(),
	to: z.string().optional(),
	timeRange: z.enum(["7d", "30d", "90d"]).optional(),
	granularity: z.enum(["hour", "day"]).default("day"),
	limit: z.coerce.number().int().min(1).max(100).default(10),
}).transform((data) => {
	const now = new Date()
	let toDate = data.to ? new Date(data.to) : now
	if (Number.isNaN(toDate.getTime())) toDate = now

	let fromDate: Date
	if (data.from) {
		fromDate = new Date(data.from)
		if (Number.isNaN(fromDate.getTime())) {
			fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000)
		}
	} else if (data.timeRange === "7d") {
		fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000)
	} else if (data.timeRange === "90d") {
		fromDate = new Date(toDate.getTime() - 90 * 24 * 60 * 60 * 1000)
	} else {
		fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000)
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
