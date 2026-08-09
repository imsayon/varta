import assert from "node:assert/strict"
import test from "node:test"
import { analyticsQuerySchema } from "./analytics.schema.ts"

test("analytics queries are bounded and consistently named", () => {
	assert.equal(analyticsQuerySchema.safeParse({ timeRange: "7d", granularity: "hour", limit: 100 }).success, true)
	assert.equal(analyticsQuerySchema.safeParse({ timeRange: "365d" }).success, false)
	assert.equal(analyticsQuerySchema.safeParse({ from: "2025-01-01T00:00:00.000Z", to: "2025-05-01T00:00:00.000Z" }).success, false)
	assert.equal(analyticsQuerySchema.safeParse({ from: "not-a-date" }).success, false)
})
