import { prisma } from "@/infra/database/prisma.ts"
import { aiMetrics } from "@/infra/ai/ai-metrics.ts"

export const STO_LOOKBACK_DAYS = 90
export const STO_MINIMUM_SAMPLE_COUNT = 10
export const STO_BATCH_SUBSCRIBERS = 500
const NEIGHBOR_LIMIT = 5
const HOURS_PER_DAY = 24
const HOUR_MS = 60 * 60 * 1_000
export type Histogram = number[]

export function hourInTimezone(date: Date, timezone: string): number {
	return Number(new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		hour: "numeric",
		hourCycle: "h23",
	}).format(date))
}

export function normalizedHistogram(hours: number[]): Histogram {
	const counts = new Map<number, number>()
	for (const hour of hours) counts.set(hour, (counts.get(hour) ?? 0) + 1)
	return normalizedHistogramFromCounts(counts)
}

export function normalizedHistogramFromCounts(counts: ReadonlyMap<number, number>): Histogram {
	const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
	return Array.from({ length: HOURS_PER_DAY }, (_, hour) =>
		total === 0 ? 0 : (counts.get(hour) ?? 0) / total)
}

export function vectorLiteral(vector: Histogram): string {
	if (vector.length !== HOURS_PER_DAY || vector.some((value) => !Number.isFinite(value))) {
		throw new Error("STO histogram must contain exactly 24 finite values")
	}
	return `[${vector.join(",")}]`
}

export function parseVector(value: string): Histogram {
	const parsed = value.replace(/[{}[\]]/g, "").split(",").map(Number)
	if (parsed.length !== HOURS_PER_DAY || parsed.some((item) => !Number.isFinite(item))) {
		throw new Error("Persisted STO histogram is invalid")
	}
	return parsed
}

export function consensusHour(vectors: Array<{ vector: Histogram; sampleCount: number }>): number {
	const weights = Array<number>(HOURS_PER_DAY).fill(0)
	for (const item of vectors) {
		for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
			weights[hour] = (weights[hour] ?? 0) + (item.vector[hour] ?? 0) * item.sampleCount
		}
	}
	return weights.reduce((best, value, hour) => value > (weights[best] ?? 0) ? hour : best, 0)
}

export function delayUntilHour(optimalHour: number, timezone: string, now = new Date()): number {
	const currentHour = hourInTimezone(now, timezone)
	return ((optimalHour - currentHour + HOURS_PER_DAY) % HOURS_PER_DAY) * HOUR_MS
}

type AggregatedRow = {
	subscriber_id: string
	timezone: string
	hour: number
	event_count: bigint
}

export const sendTimeOptimizationService = {
	async recomputeWorkspace(workspaceId: string): Promise<number> {
		const startedAt = Date.now()
		const since = new Date(Date.now() - STO_LOOKBACK_DAYS * HOURS_PER_DAY * HOUR_MS)
		let cursor = "00000000-0000-0000-0000-000000000000"
		let computed = 0

		for (;;) {
			const rows = await prisma.$queryRaw<AggregatedRow[]>`
				WITH subscriber_batch AS (
					SELECT DISTINCT e.subscriber_id
					FROM engagement_events e
					WHERE e.workspace_id = ${workspaceId}::uuid
					  AND e.subscriber_id > ${cursor}::uuid
					  AND e.occurred_at >= ${since}
					  AND e.occurred_at < now()
					  AND upper(e.event_type) IN ('OPEN', 'OPENED', 'CLICK', 'CLICKED', 'READ')
					ORDER BY e.subscriber_id
					LIMIT ${STO_BATCH_SUBSCRIBERS}
				)
				SELECT e.subscriber_id,
				       COALESCE(NULLIF(s.timezone, ''), 'UTC') AS timezone,
				       EXTRACT(HOUR FROM e.occurred_at AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'UTC'))::int AS hour,
				       COUNT(*)::bigint AS event_count
				FROM subscriber_batch b
				JOIN engagement_events e ON e.subscriber_id = b.subscriber_id
				JOIN subscribers s ON s.id = e.subscriber_id AND s.workspace_id = ${workspaceId}::uuid
				WHERE e.workspace_id = ${workspaceId}::uuid
				  AND e.occurred_at >= ${since}
				  AND e.occurred_at < now()
				  AND upper(e.event_type) IN ('OPEN', 'OPENED', 'CLICK', 'CLICKED', 'READ')
				GROUP BY e.subscriber_id, s.timezone, hour
				ORDER BY e.subscriber_id, hour
			`
			if (rows.length === 0) break

			const batch = new Map<string, { counts: Map<number, number>; sampleCount: number }>()
			for (const row of rows) {
				const entry = batch.get(row.subscriber_id) ?? { counts: new Map<number, number>(), sampleCount: 0 }
				const count = Number(row.event_count)
				entry.counts.set(row.hour, count)
				entry.sampleCount += count
				batch.set(row.subscriber_id, entry)
				cursor = row.subscriber_id
			}

			await prisma.$transaction([...batch.entries()].map(([subscriberId, entry]) => {
				const vector = normalizedHistogramFromCounts(entry.counts)
				return prisma.$executeRaw`
					INSERT INTO subscriber_engagement_vectors (subscriber_id, workspace_id, embedding, sample_count, computed_at)
					VALUES (${subscriberId}::uuid, ${workspaceId}::uuid, ${vectorLiteral(vector)}::vector, ${entry.sampleCount}, now())
					ON CONFLICT (subscriber_id) DO UPDATE
					SET workspace_id = EXCLUDED.workspace_id,
					    embedding = EXCLUDED.embedding,
					    sample_count = EXCLUDED.sample_count,
					    computed_at = EXCLUDED.computed_at
				`
			}))
			computed += batch.size
		}

		aiMetrics.stoVectorCompute(Date.now() - startedAt, workspaceId, computed)
		return computed
	},

	async getDelay(workspaceId: string, subscriberId: string, timezone: string): Promise<number> {
		const own = await prisma.$queryRaw<Array<{ embedding: string; sample_count: number }>>`
			SELECT embedding::text, sample_count
			FROM subscriber_engagement_vectors
			WHERE workspace_id = ${workspaceId}::uuid AND subscriber_id = ${subscriberId}::uuid
		`
		const current = own[0]
		if (!current || current.sample_count < STO_MINIMUM_SAMPLE_COUNT) {
			aiMetrics.stoPrediction("immediate", workspaceId)
			return 0
		}
		const neighbors = await prisma.$queryRaw<Array<{ embedding: string; sample_count: number }>>`
			SELECT embedding::text, sample_count
			FROM subscriber_engagement_vectors
			WHERE workspace_id = ${workspaceId}::uuid
			  AND subscriber_id <> ${subscriberId}::uuid
			  AND embedding IS NOT NULL
			ORDER BY embedding <=> ${current.embedding}::vector
			LIMIT ${NEIGHBOR_LIMIT}
		`
		const hour = consensusHour([
			{ vector: parseVector(current.embedding), sampleCount: current.sample_count },
			...neighbors.map((neighbor) => ({ vector: parseVector(neighbor.embedding), sampleCount: neighbor.sample_count })),
		])
		const delay = delayUntilHour(hour, timezone)
		aiMetrics.stoPrediction(delay === 0 ? "immediate" : "delayed", workspaceId)
		return delay
	},
}
