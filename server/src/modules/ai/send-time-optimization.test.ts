import assert from "node:assert/strict"
import test from "node:test"
import {
	consensusHour,
	delayUntilHour,
	hourInTimezone,
	normalizedHistogram,
	normalizedHistogramFromCounts,
	parseVector,
	vectorLiteral,
} from "./send-time-optimization.service.ts"

test("STO production histogram is normalized and exactly 24 dimensions", () => {
	const histogram = normalizedHistogram([9, 9, 10, 14, 14, 14])
	assert.equal(histogram.length, 24)
	assert.ok(Math.abs(histogram.reduce((sum, value) => sum + value, 0) - 1) < 1e-10)
	assert.equal(histogram[14], 0.5)
	assert.deepEqual(parseVector(vectorLiteral(histogram)), histogram)
	assert.throws(() => vectorLiteral([1, 2, 3]))
})

test("STO aggregated-count histogram matches raw-event construction", () => {
	const counts = new Map([[9, 2], [10, 1], [14, 3]])
	assert.deepEqual(normalizedHistogramFromCounts(counts), normalizedHistogram([9, 9, 10, 14, 14, 14]))
})

test("STO weighted consensus uses actual sample weight", () => {
	const morning = normalizedHistogram([9])
	const evening = normalizedHistogram([18])
	assert.equal(consensusHour([
		{ vector: morning, sampleCount: 2 },
		{ vector: evening, sampleCount: 10 },
	]), 18)
})

test("STO timezone handling covers DST and half-hour offsets", () => {
	const instant = new Date("2024-06-15T12:00:00Z")
	assert.equal(hourInTimezone(instant, "America/New_York"), 8)
	assert.equal(hourInTimezone(instant, "America/Los_Angeles"), 5)
	assert.equal(hourInTimezone(instant, "Asia/Kolkata"), 17)
})

test("STO delay sends within the current optimal hour and wraps midnight", () => {
	const now = new Date("2024-06-15T12:00:00Z")
	assert.equal(delayUntilHour(12, "UTC", now), 0)
	assert.equal(delayUntilHour(14, "UTC", now), 2 * 60 * 60 * 1_000)
	assert.equal(delayUntilHour(0, "UTC", new Date("2024-06-15T23:00:00Z")), 60 * 60 * 1_000)
})

test("STO deterministic holdout evaluation improves hour error over immediate send", () => {
	const cohorts = [
		{ targetHour: 8, history: [8, 8, 8, 8, 7, 9] },
		{ targetHour: 12, history: [12, 12, 12, 11, 12, 13] },
		{ targetHour: 18, history: [18, 18, 17, 18, 19, 18] },
		{ targetHour: 21, history: [21, 20, 21, 21, 22, 21] },
	]
	const immediateHour = 9
	const circularError = (predicted: number, actual: number) => {
		const distance = Math.abs(predicted - actual)
		return Math.min(distance, 24 - distance)
	}
	const stoError = cohorts.reduce((sum, cohort) => sum + circularError(
		consensusHour([{ vector: normalizedHistogram(cohort.history), sampleCount: cohort.history.length }]),
		cohort.targetHour,
	), 0) / cohorts.length
	const immediateError = cohorts.reduce(
		(sum, cohort) => sum + circularError(immediateHour, cohort.targetHour),
		0,
	) / cohorts.length
	assert.equal(stoError, 0)
	assert.ok(stoError < immediateError, `STO error ${stoError} must beat immediate error ${immediateError}`)
})
