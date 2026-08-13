import assert from "node:assert/strict"
import test from "node:test"
import { disconnectDatabase, prisma } from "@/infra/database/prisma.ts"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"
import { parseVector, sendTimeOptimizationService } from "./send-time-optimization.service.ts"

const enabled = process.env.RUN_STO_DATABASE_TESTS === "true"

test.after(async () => {
	if (enabled) await disconnectDatabase()
})

test("STO database aggregation executes the bounded production query and persists a real histogram", { skip: !enabled }, async () => {
	const fixture = await createOwnedTestWorkspace("STO integration")
	try {
		const template = await prisma.template.create({
			data: { workspaceId: fixture.workspace.id, name: "STO template", channels: {} },
		})
		const subscriber = await prisma.subscriber.create({
			data: { workspaceId: fixture.workspace.id, externalId: "sto-subscriber", timezone: "UTC" },
		})
		const notification = await prisma.notification.create({
			data: {
				workspaceId: fixture.workspace.id,
				templateId: template.id,
				subscriberId: subscriber.id,
				idempotencyKey: "sto-source",
				channels: ["IN_APP"],
			},
		})
		const base = new Date()
		base.setUTCMinutes(0, 0, 0)
		base.setUTCHours(14)
		if (base >= new Date()) base.setUTCDate(base.getUTCDate() - 1)
		await prisma.engagementEvent.createMany({
			data: Array.from({ length: 12 }, (_, index) => ({
				workspaceId: fixture.workspace.id,
				subscriberId: subscriber.id,
				notificationId: notification.id,
				eventType: index === 0 ? "DELIVERED" : "OPENED",
				channel: "IN_APP",
				occurredAt: new Date(base.getTime() + index * 1_000),
			})),
		})
		assert.equal(await sendTimeOptimizationService.recomputeWorkspace(fixture.workspace.id), 1)
		const rows = await prisma.$queryRaw<Array<{ embedding: string; sample_count: number }>>`
			SELECT embedding::text, sample_count
			FROM subscriber_engagement_vectors
			WHERE subscriber_id = ${subscriber.id}::uuid
		`
		assert.equal(rows[0]?.sample_count, 11)
		const histogram = parseVector(rows[0]!.embedding)
		assert.equal(histogram[14], 1)
	} finally {
		await fixture.cleanup()
	}
})

test("STO database: exact, HNSW, and IVFFlat plans retain representative nearest-neighbor recall", { skip: !enabled }, async () => {
	const productionIndexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
		SELECT indexname
		FROM pg_indexes
		WHERE schemaname = 'varta'
		  AND tablename = 'subscriber_engagement_vectors'
	`
	assert.ok(productionIndexes.some(({ indexname }) => indexname === "subscriber_engagement_vectors_embedding_hnsw_idx"))

	await prisma.$transaction(async (tx) => {
		await tx.$executeRawUnsafe(`
			CREATE TEMP TABLE sto_vector_benchmark (
				id integer PRIMARY KEY,
				embedding vector(24) NOT NULL
			) ON COMMIT DROP
		`)
		await tx.$executeRawUnsafe(`
			INSERT INTO sto_vector_benchmark (id, embedding)
			SELECT sample_id,
			       ('[' || array_to_string(ARRAY(
			           SELECT CASE
			             WHEN hour = sample_id % 24 THEN 1.0
			             ELSE ((sample_id * (hour + 3)) % 17)::double precision / 1000.0
			           END
			           FROM generate_series(0, 23) AS hour
			       ), ',') || ']')::vector
			FROM generate_series(1, 1500) AS sample_id
		`)
		await tx.$executeRawUnsafe("ANALYZE sto_vector_benchmark")
		await tx.$executeRawUnsafe("SET LOCAL enable_indexscan = off")
		await tx.$executeRawUnsafe("SET LOCAL enable_bitmapscan = off")
		const exact = await tx.$queryRawUnsafe<Array<{ id: number }>>(`
			SELECT id
			FROM sto_vector_benchmark
			WHERE id <> 333
			ORDER BY embedding <=> (SELECT embedding FROM sto_vector_benchmark WHERE id = 333)
			LIMIT 10
		`)

		await tx.$executeRawUnsafe("SET LOCAL enable_indexscan = on")
		await tx.$executeRawUnsafe("SET LOCAL enable_bitmapscan = on")
		await tx.$executeRawUnsafe("CREATE INDEX sto_vector_benchmark_hnsw_idx ON sto_vector_benchmark USING hnsw (embedding vector_cosine_ops)")
		await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off")
		const hnswPlan = await tx.$queryRawUnsafe<unknown[]>(`
			EXPLAIN (ANALYZE, FORMAT JSON)
			SELECT id FROM sto_vector_benchmark
			WHERE id <> 333
			ORDER BY embedding <=> (SELECT embedding FROM sto_vector_benchmark WHERE id = 333)
			LIMIT 10
		`)
		const hnsw = await tx.$queryRawUnsafe<Array<{ id: number }>>(`
			SELECT id FROM sto_vector_benchmark
			WHERE id <> 333
			ORDER BY embedding <=> (SELECT embedding FROM sto_vector_benchmark WHERE id = 333)
			LIMIT 10
		`)
		assert.match(JSON.stringify(hnswPlan), /sto_vector_benchmark_hnsw_idx/)

		await tx.$executeRawUnsafe("DROP INDEX sto_vector_benchmark_hnsw_idx")
		await tx.$executeRawUnsafe("CREATE INDEX sto_vector_benchmark_ivfflat_idx ON sto_vector_benchmark USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20)")
		await tx.$executeRawUnsafe("SET LOCAL ivfflat.probes = 10")
		const ivfflatPlan = await tx.$queryRawUnsafe<unknown[]>(`
			EXPLAIN (ANALYZE, FORMAT JSON)
			SELECT id FROM sto_vector_benchmark
			WHERE id <> 333
			ORDER BY embedding <=> (SELECT embedding FROM sto_vector_benchmark WHERE id = 333)
			LIMIT 10
		`)
		const ivfflat = await tx.$queryRawUnsafe<Array<{ id: number }>>(`
			SELECT id FROM sto_vector_benchmark
			WHERE id <> 333
			ORDER BY embedding <=> (SELECT embedding FROM sto_vector_benchmark WHERE id = 333)
			LIMIT 10
		`)
		assert.match(JSON.stringify(ivfflatPlan), /sto_vector_benchmark_ivfflat_idx/)

		const exactIds = new Set(exact.map(({ id }) => id))
		const recall = (rows: Array<{ id: number }>) => rows.filter(({ id }) => exactIds.has(id)).length / exactIds.size
		assert.ok(recall(hnsw) >= 0.9, `HNSW recall was ${recall(hnsw)}`)
		assert.ok(recall(ivfflat) >= 0.8, `IVFFlat recall was ${recall(ivfflat)}`)
	}, { timeout: 30_000 })
})
