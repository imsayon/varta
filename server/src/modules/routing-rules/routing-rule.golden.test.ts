import assert from "node:assert/strict"
import test from "node:test"
import { routingRuleAstSchema } from "./routing-rule.schema.ts"
import { matchesRoutingRule } from "./routing-rule.evaluator.ts"

// --- Routing-rule compiler: adversarial and multilingual golden fixtures ---
// These tests prove the AST evaluator and schema validation are deterministic,
// field-restricted, and injection-safe.

// Golden fixture: all supported operators
const ALL_OPERATORS_FIXTURE = {
	logic: "AND" as const,
	conditions: [
		{ field: "subscriber.attributes.plan", op: "eq" as const, value: "pro" },
		{ field: "subscriber.attributes.score", op: "neq" as const, value: 0 },
		{ field: "subscriber.attributes.age", op: "gt" as const, value: 17 },
		{ field: "subscriber.attributes.age", op: "lt" as const, value: 100 },
		{ field: "subscriber.attributes.age", op: "gte" as const, value: 18 },
		{ field: "subscriber.attributes.age", op: "lte" as const, value: 99 },
		{ field: "subscriber.attributes.tags", op: "contains" as const, value: "beta" },
		{ field: "subscriber.attributes.role", op: "in" as const, value: ["admin", "owner"] },
		{ field: "subscriber.attributes.banned", op: "not_in" as const, value: [true] },
		{ field: "subscriber.attributes.verified", op: "exists" as const },
	],
	channels: ["EMAIL" as const],
}

test("routing-rule evaluator: golden deterministic match for all operators", () => {
	const match = matchesRoutingRule(ALL_OPERATORS_FIXTURE, {
		attributes: {
			plan: "pro",
			score: 1,
			age: 25,
			tags: "early-beta-user",
			role: "admin",
			banned: "no",
			verified: true,
		},
		preferences: {},
	})
	assert.equal(match, true)
})

test("routing-rule evaluator: golden deterministic non-match when one condition fails", () => {
	// age < 18 fails gte(18)
	const match = matchesRoutingRule(ALL_OPERATORS_FIXTURE, {
		attributes: {
			plan: "pro",
			score: 1,
			age: 16,
			tags: "early-beta-user",
			role: "admin",
			banned: "no",
			verified: true,
		},
		preferences: {},
	})
	assert.equal(match, false)
})

test("routing-rule evaluator: OR logic matches when any condition is true", () => {
	const rule = {
		logic: "OR" as const,
		conditions: [
			{ field: "subscriber.attributes.plan", op: "eq" as const, value: "pro" },
			{ field: "subscriber.attributes.plan", op: "eq" as const, value: "business" },
		],
		channels: ["IN_APP" as const],
	}
	assert.equal(matchesRoutingRule(rule, { attributes: { plan: "free" }, preferences: {} }), false)
	assert.equal(matchesRoutingRule(rule, { attributes: { plan: "pro" }, preferences: {} }), true)
	assert.equal(matchesRoutingRule(rule, { attributes: { plan: "business" }, preferences: {} }), true)
})

test("routing-rule evaluator: empty AND conditions always matches (vacuously true)", () => {
	const rule = { logic: "AND" as const, conditions: [], channels: ["EMAIL" as const] }
	assert.equal(matchesRoutingRule(rule, { attributes: {}, preferences: {} }), true)
})

test("routing-rule evaluator: empty conditions always matches (pass-through for both AND/OR)", () => {
	// The evaluator short-circuits: empty conditions → true regardless of logic.
	// This is the documented behavior: no conditions means any subscriber is eligible.
	const orRule = { logic: "OR" as const, conditions: [], channels: ["EMAIL" as const] }
	assert.equal(matchesRoutingRule(orRule, { attributes: {}, preferences: {} }), true,
		"empty OR → true (short-circuit: no conditions to fail)")
})

// --- Adversarial schema validation ---

test("routing-rule schema rejects unknown field namespaces", () => {
	const disallowedFields = [
		"workspace.secret",
		"user.password",
		"system.env",
		"__proto__.pollution",
		"constructor.name",
	]
	for (const field of disallowedFields) {
		const result = routingRuleAstSchema.safeParse({
			logic: "AND",
			conditions: [{ field, op: "exists" }],
			channels: ["EMAIL"],
		})
		assert.ok(!result.success, `should reject field: ${field}`)
	}
})

test("routing-rule schema rejects depth/size limits", () => {
	// Exceeds max conditions (20)
	const tooManyConditions = routingRuleAstSchema.safeParse({
		logic: "AND",
		conditions: Array.from({ length: 21 }, (_, i) => ({
			field: `subscriber.attributes.x${i}`,
			op: "exists",
		})),
		channels: ["EMAIL"],
	})
	assert.ok(!tooManyConditions.success, "21 conditions exceeds max")

	// Exactly 20 is valid
	const exactlyMax = routingRuleAstSchema.safeParse({
		logic: "AND",
		conditions: Array.from({ length: 20 }, (_, i) => ({
			field: `subscriber.attributes.x${i}`,
			op: "exists",
		})),
		channels: ["EMAIL"],
	})
	assert.ok(exactlyMax.success, "20 conditions is within limit")
})

test("routing-rule schema rejects unknown operators", () => {
	const result = routingRuleAstSchema.safeParse({
		logic: "AND",
		conditions: [{ field: "subscriber.attributes.x", op: "EVAL", value: "DROP TABLE" }],
		channels: ["EMAIL"],
	})
	assert.ok(!result.success, "unknown operator must be rejected")
})

test("routing-rule schema rejects unknown channels", () => {
	const result = routingRuleAstSchema.safeParse({
		logic: "AND",
		conditions: [],
		channels: ["SMS", "PUSH"],
	})
	assert.ok(!result.success, "unsupported channels must be rejected")
})

test("routing-rule schema rejects empty channels array", () => {
	const result = routingRuleAstSchema.safeParse({
		logic: "AND",
		conditions: [],
		channels: [],
	})
	assert.ok(!result.success, "at least one channel is required")
})

test("routing-rule schema accepts valid preferences namespace", () => {
	const result = routingRuleAstSchema.safeParse({
		logic: "AND",
		conditions: [{ field: "subscriber.preferences.email_enabled", op: "eq", value: true }],
		channels: ["EMAIL"],
	})
	assert.ok(result.success, "subscriber.preferences.* is a valid field namespace")
})

// --- Multilingual / Unicode field values ---
test("routing-rule evaluator handles Unicode attribute values correctly", () => {
	const rule = {
		logic: "AND" as const,
		conditions: [
			{ field: "subscriber.attributes.locale", op: "eq" as const, value: "हिन्दी" },
		],
		channels: ["IN_APP" as const],
	}
	assert.equal(matchesRoutingRule(rule, { attributes: { locale: "हिन्दी" }, preferences: {} }), true)
	assert.equal(matchesRoutingRule(rule, { attributes: { locale: "english" }, preferences: {} }), false)
})

test("routing-rule evaluator: in operator handles array membership correctly", () => {
	const rule = {
		logic: "AND" as const,
		conditions: [
			{ field: "subscriber.attributes.tier", op: "in" as const, value: ["gold", "platinum"] },
		],
		channels: ["EMAIL" as const],
	}
	assert.equal(matchesRoutingRule(rule, { attributes: { tier: "gold" }, preferences: {} }), true)
	assert.equal(matchesRoutingRule(rule, { attributes: { tier: "silver" }, preferences: {} }), false)
	assert.equal(matchesRoutingRule(rule, { attributes: { tier: "platinum" }, preferences: {} }), true)
})
