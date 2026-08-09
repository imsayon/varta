import { prisma } from "@/infra/database/prisma.ts"
import { redis } from "@/infra/redis/redis.connection.ts"
import type { AnalyticsQuery } from "./analytics.schema.ts"
import { logger } from "@/infra/observability/logger.ts"

const ANALYTICS_CACHE_TTL_SECONDS = 60

async function versionedCacheKey(workspaceId: string, suffix: string): Promise<string> {
	let version = "0"
	try {
		version = (await redis.get(`analytics:${workspaceId}:version`)) ?? "0"
	} catch {
		// Analytics remains available when Redis is degraded.
	}
	return `analytics:${workspaceId}:v${version}:${suffix}`
}

export async function invalidateAnalyticsCache(workspaceId: string): Promise<void> {
	try {
		await redis.incr(`analytics:${workspaceId}:version`)
	} catch (error) {
		logger.warn({ err: error }, "Analytics cache invalidation failed")
	}
}

function range(query: AnalyticsQuery) {
	return { from: new Date(query.from), to: new Date(query.to) }
}

function assertRange(query: AnalyticsQuery) {
	const { from, to } = range(query)
	if (from >= to) throw new Error("Analytics 'from' must be before 'to'")
	return { from, to }
}

async function getCachedOrFetch<T>(
	key: string,
	fetcher: () => Promise<T>,
): Promise<T> {
	try {
		const cached = await redis.get(key)
		if (cached) {
			return JSON.parse(cached, (_k, v) =>
				typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)
					? new Date(v)
					: v,
			)
		}
	} catch (error) {
		logger.warn(
			{ err: error, cacheKey: key },
			"Analytics cache read failed",
		)
	}

	const data = await fetcher()

	try {
		await redis.set(
			key,
			JSON.stringify(data),
			"EX",
			ANALYTICS_CACHE_TTL_SECONDS,
		)
	} catch (error) {
		logger.warn(
			{ err: error, cacheKey: key },
			"Analytics cache write failed",
		)
	}

	return data
}

export const analyticsService = {
	async overview(workspaceId: string, query: AnalyticsQuery) {
		const cacheKey = await versionedCacheKey(workspaceId, `overview:${query.from}:${query.to}`)
		return getCachedOrFetch(cacheKey, async () => {
			const { from, to } = assertRange(query)
			const [totals, byChannel, engagement] = await Promise.all([
				prisma.$queryRaw<
					Array<{ sent: bigint; delivered: bigint; failed: bigint }>
				>`
					WITH logical_deliveries AS (
						SELECT da.notification_id, da.channel,
							MAX(da.attempt_number) AS max_attempt,
							BOOL_OR(da.started_at IS NOT NULL) AS attempted,
							BOOL_OR(da.status = 'SUCCESS') AS succeeded,
							BOOL_OR(da.status = 'DLQ' OR (da.status = 'FAILED' AND da.attempt_number >= 5)) AS failed
						FROM delivery_attempts da
						JOIN notifications n ON n.id = da.notification_id
						WHERE n.workspace_id = ${workspaceId}::uuid
						  AND da.started_at >= ${from}
						  AND da.started_at < ${to}
						GROUP BY da.notification_id, da.channel
					)
					SELECT
						COUNT(*) FILTER (WHERE attempted) AS sent,
						COUNT(*) FILTER (WHERE succeeded) AS delivered,
						COUNT(*) FILTER (WHERE failed AND NOT succeeded) AS failed
					FROM logical_deliveries
				`,
				prisma.$queryRaw<
					Array<{
						channel: string
						sent: bigint
						delivered: bigint
						failed: bigint
					}>
				>`
					WITH logical_deliveries AS (
						SELECT da.notification_id, da.channel,
							BOOL_OR(da.started_at IS NOT NULL) AS attempted,
							BOOL_OR(da.status = 'SUCCESS') AS succeeded,
							BOOL_OR(da.status = 'DLQ' OR (da.status = 'FAILED' AND da.attempt_number >= 5)) AS failed
						FROM delivery_attempts da
						JOIN notifications n ON n.id = da.notification_id
						WHERE n.workspace_id = ${workspaceId}::uuid
						  AND da.started_at >= ${from}
						  AND da.started_at < ${to}
						GROUP BY da.notification_id, da.channel
					)
					SELECT channel,
						COUNT(*) FILTER (WHERE attempted) AS sent,
						COUNT(*) FILTER (WHERE succeeded) AS delivered,
						COUNT(*) FILTER (WHERE failed AND NOT succeeded) AS failed
					FROM logical_deliveries
					GROUP BY channel
				`,
				prisma.$queryRaw<Array<{ opened: bigint; clicked: bigint }>>`
					SELECT
						COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'opened') AS opened,
						COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'clicked') AS clicked
					FROM engagement_events
					WHERE workspace_id = ${workspaceId}::uuid
					  AND occurred_at >= ${from} AND occurred_at < ${to}
				`,
			])
			const total = Number(totals[0]?.sent ?? 0n)
			const delivered = Number(totals[0]?.delivered ?? 0n)
			const failed = Number(totals[0]?.failed ?? 0n)
			const denominator = delivered + failed
			return {
				totalSent: total,
				delivered,
				failed,
				deliveryRate: denominator ? delivered / denominator : 0,
				byChannel: Object.fromEntries(
					byChannel.map((row) => {
						const sent = Number(row.sent)
						const channelDelivered = Number(row.delivered)
						const channelFailed = Number(row.failed)
						return [
							row.channel,
							{
								sent,
								delivered: channelDelivered,
								failed: channelFailed,
								deliveryRate:
									channelDelivered + channelFailed
										? channelDelivered /
											(channelDelivered + channelFailed)
										: 0,
							},
						]
					}),
				),
				openRate: total
					? Number(engagement[0]?.opened ?? 0n) / total
					: 0,
				clickRate: total
					? Number(engagement[0]?.clicked ?? 0n) / total
					: 0,
			}
		})
	},

	async deliveryTimeline(workspaceId: string, query: AnalyticsQuery) {
		const cacheKey = await versionedCacheKey(workspaceId, `timeline:${query.from}:${query.to}:${query.granularity}`)
		return getCachedOrFetch(cacheKey, async () => {
			const { from, to } = assertRange(query)
			const bucket = query.granularity === "hour" ? "hour" : "day"
			const rows = await prisma.$queryRaw<
				Array<{
					timestamp: Date
					sent: bigint
					delivered: bigint
					failed: bigint
				}>
			>`
				WITH logical_deliveries AS (
					SELECT da.notification_id, da.channel,
						DATE_TRUNC(${bucket}, MIN(da.started_at)) AS timestamp,
						BOOL_OR(da.started_at IS NOT NULL) AS attempted,
						BOOL_OR(da.status = 'SUCCESS') AS succeeded,
						BOOL_OR(da.status = 'DLQ' OR (da.status = 'FAILED' AND da.attempt_number >= 5)) AS failed
					FROM delivery_attempts da
					JOIN notifications n ON n.id = da.notification_id
					WHERE n.workspace_id = ${workspaceId}::uuid
					  AND da.started_at >= ${from} AND da.started_at < ${to}
					GROUP BY da.notification_id, da.channel
				)
				SELECT timestamp,
					COUNT(*) FILTER (WHERE attempted) AS sent,
					COUNT(*) FILTER (WHERE succeeded) AS delivered,
					COUNT(*) FILTER (WHERE failed AND NOT succeeded) AS failed
				FROM logical_deliveries
				GROUP BY timestamp ORDER BY timestamp ASC
			`
			return rows.map((r) => ({
				timestamp: r.timestamp,
				sent: Number(r.sent),
				delivered: Number(r.delivered),
				failed: Number(r.failed),
			}))
		})
	},

	async channelBreakdown(workspaceId: string, query: AnalyticsQuery) {
		const cacheKey = await versionedCacheKey(workspaceId, `breakdown:${query.from}:${query.to}`)
		return getCachedOrFetch(cacheKey, async () => {
			const { from, to } = assertRange(query)
			const rows = await prisma.$queryRaw<
				Array<{
					channel: string
					sent: bigint
					delivered: bigint
					failed: bigint
					avg_duration_ms: number | null
				}>
			>`
				WITH logical_deliveries AS (
					SELECT da.notification_id, da.channel,
						MAX(da.duration_ms) FILTER (WHERE da.status = 'SUCCESS') AS duration_ms,
						BOOL_OR(da.started_at IS NOT NULL) AS attempted,
						BOOL_OR(da.status = 'SUCCESS') AS succeeded,
						BOOL_OR(da.status = 'DLQ' OR (da.status = 'FAILED' AND da.attempt_number >= 5)) AS failed
					FROM delivery_attempts da
					JOIN notifications n ON n.id = da.notification_id
					WHERE n.workspace_id = ${workspaceId}::uuid
					  AND da.started_at >= ${from} AND da.started_at < ${to}
					GROUP BY da.notification_id, da.channel
				)
				SELECT channel,
					COUNT(*) FILTER (WHERE attempted) AS sent,
					COUNT(*) FILTER (WHERE succeeded) AS delivered,
					COUNT(*) FILTER (WHERE failed AND NOT succeeded) AS failed,
					AVG(duration_ms) FILTER (WHERE succeeded) AS avg_duration_ms
				FROM logical_deliveries GROUP BY channel ORDER BY channel
			`
			return rows.map((r) => ({
				channel: r.channel,
				sent: Number(r.sent),
				delivered: Number(r.delivered),
				failed: Number(r.failed),
				avgDurationMs: r.avg_duration_ms
					? Number(r.avg_duration_ms)
					: null,
			}))
		})
	},

	async topTemplates(workspaceId: string, query: AnalyticsQuery) {
		const cacheKey = await versionedCacheKey(workspaceId, `toptemplates:${query.from}:${query.to}:${query.limit}`)
		return getCachedOrFetch(cacheKey, async () => {
			const { from, to } = assertRange(query)
			const rows = await prisma.$queryRaw<
				Array<{
					template_id: string
					name: string
					sent: bigint
					delivered: bigint
					open_rate: number
				}>
			>`
				WITH logical_deliveries AS (
					SELECT da.notification_id, da.channel,
						BOOL_OR(da.started_at IS NOT NULL) AS attempted,
						BOOL_OR(da.status = 'SUCCESS') AS succeeded
					FROM delivery_attempts da
					JOIN notifications n ON n.id = da.notification_id
					WHERE n.workspace_id = ${workspaceId}::uuid
					  AND da.started_at >= ${from} AND da.started_at < ${to}
					GROUP BY da.notification_id, da.channel
				), opened AS (
					SELECT DISTINCT notification_id
					FROM engagement_events
					WHERE workspace_id = ${workspaceId}::uuid
					  AND event_type = 'opened'
					  AND occurred_at >= ${from} AND occurred_at < ${to}
				), template_stats AS (
					SELECT n.template_id, t.name,
						COUNT(*) FILTER (WHERE ld.attempted) AS sent,
						COUNT(*) FILTER (WHERE ld.succeeded) AS delivered,
						COUNT(DISTINCT opened.notification_id) AS opened
					FROM logical_deliveries ld
					JOIN notifications n ON n.id = ld.notification_id
					JOIN templates t ON t.id = n.template_id
					LEFT JOIN opened ON opened.notification_id = n.id
					GROUP BY n.template_id, t.name
				)
				SELECT template_id, name, sent, delivered,
					CASE WHEN sent = 0 THEN 0 ELSE opened::double precision / sent END AS open_rate
				FROM template_stats ORDER BY sent DESC LIMIT ${query.limit}
			`
			return rows.map((r) => ({
				templateId: r.template_id,
				name: r.name,
				sent: Number(r.sent),
				delivered: Number(r.delivered),
				openRate: Number(r.open_rate),
			}))
		})
	},
}
