import { prisma } from "@/infra/database/prisma.ts"
import { aiMetrics } from "@/infra/ai/ai-metrics.ts"

const LOOKBACK_DAYS = 90
const MINIMUM_SAMPLE_COUNT = 10
const NEIGHBOR_LIMIT = 5
const HOURS_PER_DAY = 24
const HOUR_MS = 60 * 60 * 1000
type Histogram = number[]

function hourInTimezone(date: Date, timezone: string): number {
	return Number(
		new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			hour: "numeric",
			hourCycle: "h23",
		}).format(date),
	)
}

function normalizedHistogram(hours: number[]): Histogram {
	const histogram = Array<number>(HOURS_PER_DAY).fill(0)
	for (const hour of hours) histogram[hour] = (histogram[hour] ?? 0) + 1
	return hours.length === 0
		? histogram
		: histogram.map((value) => value / hours.length)
}

function vectorLiteral(vector: Histogram): string {
	return `[${vector.join(",")}]`
}

function parseVector(value: string): Histogram {
	return value
		.replace(/[{}[\]]/g, "")
		.split(",")
		.map(Number)
}

function consensusHour(
	vectors: Array<{ vector: Histogram; sampleCount: number }>,
): number {
	const weights = Array<number>(HOURS_PER_DAY).fill(0)
	for (const item of vectors) {
		for (let hour = 0; hour < HOURS_PER_DAY; hour++)
			weights[hour] =
				(weights[hour] ?? 0) +
				(item.vector[hour] ?? 0) * item.sampleCount
	}
	return weights.reduce(
		(best, value, hour) => (value > (weights[best] ?? 0) ? hour : best),
		0,
	)
}

function delayUntilHour(optimalHour: number, timezone: string): number {
	const currentHour = hourInTimezone(new Date(), timezone)
	const hoursUntil =
		(optimalHour - currentHour + HOURS_PER_DAY) % HOURS_PER_DAY
	return (hoursUntil === 0 ? HOURS_PER_DAY : hoursUntil) * HOUR_MS
}

export const sendTimeOptimizationService = {
	async recomputeWorkspace(workspaceId: string): Promise<number> {
		const startedAt = Date.now()
		const since = new Date(
			Date.now() - LOOKBACK_DAYS * HOURS_PER_DAY * HOUR_MS,
		)

		// Aggregated fetch of subscriber engagement events in a single query
		const rows = await prisma.$queryRaw<
			Array<{ subscriber_id: string; timezone: string | null; occurred_at: Date }>
		>`
			SELECT e.subscriber_id, s.timezone, e.occurred_at
			FROM engagement_events e
			JOIN subscribers s ON s.id = e.subscriber_id
			WHERE e.workspace_id = ${workspaceId}::uuid
			  AND e.occurred_at >= ${since}
		`

		if (rows.length === 0) {
			aiMetrics.stoVectorCompute(Date.now() - startedAt, workspaceId, 0)
			return 0
		}

		// Group events by subscriber in memory
		const subscriberEventsMap = new Map<string, { timezone: string; hours: number[] }>()
		for (const row of rows) {
			const subId = row.subscriber_id
			const tz = row.timezone ?? "UTC"
			const hour = hourInTimezone(row.occurred_at, tz)

			const entry = subscriberEventsMap.get(subId) ?? { timezone: tz, hours: [] }
			entry.hours.push(hour)
			subscriberEventsMap.set(subId, entry)
		}

		let computed = 0
		for (const [subscriberId, { hours }] of subscriberEventsMap.entries()) {
			if (hours.length === 0) continue
			const vector = normalizedHistogram(hours)
			await prisma.$executeRaw`
				INSERT INTO subscriber_engagement_vectors (subscriber_id, workspace_id, embedding, sample_count, computed_at)
				VALUES (${subscriberId}::uuid, ${workspaceId}::uuid, ${vectorLiteral(vector)}::vector, ${hours.length}, now())
				ON CONFLICT (subscriber_id) DO UPDATE SET embedding = EXCLUDED.embedding, sample_count = EXCLUDED.sample_count, computed_at = EXCLUDED.computed_at
			`
			computed += 1
		}

		aiMetrics.stoVectorCompute(
			Date.now() - startedAt,
			workspaceId,
			computed,
		)
		return computed
	},

	async getDelay(
		workspaceId: string,
		subscriberId: string,
		timezone: string,
	): Promise<number> {
		const own = await prisma.$queryRaw<
			Array<{ embedding: string; sample_count: number }>
		>`
			SELECT embedding::text, sample_count FROM subscriber_engagement_vectors WHERE workspace_id = ${workspaceId}::uuid AND subscriber_id = ${subscriberId}::uuid
		`
		const current = own[0]
		if (!current || current.sample_count < MINIMUM_SAMPLE_COUNT) {
			aiMetrics.stoPrediction("immediate", workspaceId)
			return 0
		}
		const neighbors = await prisma.$queryRaw<
			Array<{ embedding: string; sample_count: number }>
		>`
			SELECT embedding::text, sample_count FROM subscriber_engagement_vectors
			WHERE workspace_id = ${workspaceId}::uuid AND subscriber_id <> ${subscriberId}::uuid
			ORDER BY embedding <=> ${current.embedding}::vector LIMIT ${NEIGHBOR_LIMIT}
		`
		const hour = consensusHour([
			{
				vector: parseVector(current.embedding),
				sampleCount: current.sample_count,
			},
			...neighbors.map((neighbor) => ({
				vector: parseVector(neighbor.embedding),
				sampleCount: neighbor.sample_count,
			})),
		])
		const delay = delayUntilHour(hour, timezone)
		aiMetrics.stoPrediction("delayed", workspaceId)
		return delay
	},
}
