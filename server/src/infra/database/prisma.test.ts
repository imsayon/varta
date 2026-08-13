import assert from "node:assert/strict"
import test from "node:test"
import { getDatabasePoolStats } from "./prisma.ts"

test("database pool stats expose sane numeric counters", () => {
	const stats = getDatabasePoolStats()

	assert.deepEqual(Object.keys(stats), ["total", "idle", "waiting"])
	for (const value of Object.values(stats)) {
		assert.equal(typeof value, "number")
		assert.equal(Number.isInteger(value), true)
		assert.equal(value >= 0, true)
	}
	assert.equal(stats.idle <= stats.total, true)
})
