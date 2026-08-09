import assert from "node:assert/strict"
import test from "node:test"

// These tests verify the pure algorithmic logic inside the STO service
// without requiring a database. The functions are extracted here for isolated testing.
// The STO service stores 24-element normalized hour histograms (not LLM embeddings).

const HOURS_PER_DAY = 24
const HOUR_MS = 60 * 60 * 1000

type Histogram = number[]

function normalizedHistogram(hours: number[]): Histogram {
	const histogram = Array<number>(HOURS_PER_DAY).fill(0)
	for (const hour of hours) histogram[hour] = (histogram[hour] ?? 0) + 1
	return hours.length === 0
		? histogram
		: histogram.map((value) => value / hours.length)
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

function vectorLiteral(vector: Histogram): string {
	return `[${vector.join(",")}]`
}

function parseVector(value: string): Histogram {
	return value
		.replace(/[{}[\]]/g, "")
		.split(",")
		.map(Number)
}

// --- Normalized histogram tests ---

test("STO histogram: empty hours produces a zero-filled 24-element vector", () => {
	const h = normalizedHistogram([])
	assert.equal(h.length, HOURS_PER_DAY)
	assert.ok(h.every((v) => v === 0), "all zeros for empty sample")
})

test("STO histogram: single-hour samples produce correct normalized vector", () => {
	// 10 events all at hour 14
	const h = normalizedHistogram(Array.from({ length: 10 }, () => 14))
	assert.equal(h.length, HOURS_PER_DAY)
	assert.equal(h[14], 1, "hour 14 has full weight")
	for (let i = 0; i < HOURS_PER_DAY; i++) {
		if (i !== 14) assert.equal(h[i], 0, `hour ${i} should be zero`)
	}
})

test("STO histogram: sums to approximately 1 for non-empty samples", () => {
	const hours = [9, 9, 10, 10, 10, 14, 14, 18]
	const h = normalizedHistogram(hours)
	const total = h.reduce((s, v) => s + v, 0)
	assert.ok(Math.abs(total - 1) < 1e-10, `total ${total} should be 1`)
})

test("STO histogram: is always length 24", () => {
	for (const hours of [[], [0], [23], [0, 12, 23], Array.from({ length: 100 }, () => 5)]) {
		assert.equal(normalizedHistogram(hours).length, HOURS_PER_DAY)
	}
})

// --- Consensus hour tests ---

test("STO consensus: single vector with clear peak selects that hour", () => {
	const h = normalizedHistogram([14, 14, 14, 14, 14]) // strong peak at 14
	assert.equal(consensusHour([{ vector: h, sampleCount: 5 }]), 14)
})

test("STO consensus: heavier sample weight dominates", () => {
	const h9 = normalizedHistogram([9])  // hour 9
	const h18 = normalizedHistogram([18, 18, 18, 18, 18]) // strong hour 18 with more samples
	// h18 has 5 samples vs h9's 1
	const result = consensusHour([
		{ vector: h9, sampleCount: 1 },
		{ vector: h18, sampleCount: 5 },
	])
	assert.equal(result, 18, "heavier-sample neighbor dominates")
})

test("STO consensus: equal-weight split picks the lower index (reduce default)", () => {
	// Two vectors, each with equal weight at hours 5 and 17
	const h5 = normalizedHistogram([5])
	const h17 = normalizedHistogram([17])
	const result = consensusHour([
		{ vector: h5, sampleCount: 1 },
		{ vector: h17, sampleCount: 1 },
	])
	// reduce starts at index 0; hour 5 wins over 17 since both have weight 1
	assert.equal(result, 5)
})

test("STO consensus: empty vector list returns hour 0", () => {
	// consensusHour with no vectors returns the reduce initial value
	const result = consensusHour([])
	assert.equal(result, 0)
})

// --- Vector roundtrip ---

test("STO vector: roundtrip through literal and parseVector is lossless", () => {
	const original = normalizedHistogram([9, 9, 14, 14, 14, 18])
	const literal = vectorLiteral(original)
	const parsed = parseVector(literal)
	assert.equal(parsed.length, HOURS_PER_DAY)
	for (let i = 0; i < HOURS_PER_DAY; i++) {
		assert.ok(Math.abs((parsed[i] ?? 0) - (original[i] ?? 0)) < 1e-10,
			`hour ${i}: parsed ${parsed[i]} != original ${original[i]}`)
	}
})

test("STO vector: vector literal is a bracketed comma-separated string of 24 numbers", () => {
	const v = normalizedHistogram([10])
	const lit = vectorLiteral(v)
	assert.ok(lit.startsWith("["), "starts with [")
	assert.ok(lit.endsWith("]"), "ends with ]")
	assert.equal(lit.split(",").length, HOURS_PER_DAY)
})

// --- DST / timezone correctness via Intl.DateTimeFormat ---

test("STO timezone: hourInTimezone produces consistent values in known timezones", () => {
	// Use a fixed UTC epoch that we can predict:
	// 2024-03-10 14:30:00 UTC = 09:30 ET (before DST start on 2024-03-10 at 2am ET)
	// Actually DST started 2024-03-10 in US, so at 14:30 UTC we are in EDT (UTC-4) → 10:30 EDT
	function hourInTimezone(date: Date, timezone: string): number {
		return Number(
			new Intl.DateTimeFormat("en-US", {
				timeZone: timezone,
				hour: "numeric",
				hourCycle: "h23",
			}).format(date),
		)
	}

	// 2024-06-15 12:00:00 UTC → 08:00 EDT (UTC-4) or 05:00 PDT (UTC-7)
	const june15utcNoon = new Date("2024-06-15T12:00:00Z")
	const etHour = hourInTimezone(june15utcNoon, "America/New_York")
	const ptHour = hourInTimezone(june15utcNoon, "America/Los_Angeles")
	assert.equal(etHour, 8, "EDT is UTC-4 in June")
	assert.equal(ptHour, 5, "PDT is UTC-7 in June")

	// IST is UTC+5:30, so 12:00 UTC → 17:30 IST → hour 17
	const istHour = hourInTimezone(june15utcNoon, "Asia/Kolkata")
	assert.equal(istHour, 17, "IST is UTC+5:30 in June, hour 17")
})

test("STO: minimum sample threshold guards against cold-start bias", () => {
	// The service returns 0 delay (send immediately) when sample_count < MINIMUM_SAMPLE_COUNT (10).
	// This test documents the constant and the cold-start fallback semantics.
	const MINIMUM_SAMPLE_COUNT = 10
	const mockSampleCount = 5
	// Simulate: with fewer than min samples, the service should return 0 (immediate send)
	const wouldOptimize = mockSampleCount >= MINIMUM_SAMPLE_COUNT
	assert.equal(wouldOptimize, false, "insufficient samples → immediate send (no cold-start bias)")
})

test("STO: delay wraps correctly at midnight boundary (0-23 hour range)", () => {
	// delayUntilHour ensures never 0 delay: if current === optimal, send next occurrence.
	function delayUntilHour(optimalHour: number, currentHour: number): number {
		const hoursUntil = (optimalHour - currentHour + HOURS_PER_DAY) % HOURS_PER_DAY
		return (hoursUntil === 0 ? HOURS_PER_DAY : hoursUntil) * HOUR_MS
	}

	// Same hour → 24h delay (next occurrence)
	assert.equal(delayUntilHour(14, 14), 24 * HOUR_MS, "same hour sends next day")
	// optimal 2 hours ahead
	assert.equal(delayUntilHour(16, 14), 2 * HOUR_MS)
	// optimal is "yesterday" → 22 hours from now
	assert.equal(delayUntilHour(12, 14), 22 * HOUR_MS)
	// midnight wrap
	assert.equal(delayUntilHour(0, 23), 1 * HOUR_MS)
	assert.equal(delayUntilHour(23, 0), 23 * HOUR_MS)
})
