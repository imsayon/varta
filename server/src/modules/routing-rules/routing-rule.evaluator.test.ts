import assert from "node:assert/strict"
import test from "node:test"
import { routingRuleAstSchema } from "./routing-rule.schema.ts"
import { matchesRoutingRule } from "./routing-rule.evaluator.ts"

test("routing rules are deterministic across supported operators", () => {
	const ast = {
		logic: "AND",
		conditions: [
			{ field: "subscriber.attributes.plan", op: "eq", value: "pro" },
			{ field: "subscriber.attributes.age", op: "gte", value: 18 },
			{ field: "subscriber.preferences.email", op: "neq", value: false },
		],
		channels: ["EMAIL", "IN_APP"],
	}
	assert.equal(matchesRoutingRule(ast, { attributes: { plan: "pro", age: 21 }, preferences: { email: true } }), true)
	assert.equal(matchesRoutingRule(ast, { attributes: { plan: "free", age: 21 }, preferences: { email: true } }), false)
})

test("routing AST rejects unbounded and unauthorized fields", () => {
	assert.equal(routingRuleAstSchema.safeParse({ logic: "AND", conditions: [{ field: "workspace.secret", op: "exists" }], channels: ["EMAIL"] }).success, false)
	assert.equal(routingRuleAstSchema.safeParse({ logic: "AND", conditions: Array.from({ length: 21 }, (_, i) => ({ field: `subscriber.attributes.x${i}`, op: "exists" })), channels: ["EMAIL"] }).success, false)
})

test("routing compares JSON objects independently of property order", () => {
	const attributes = { profile: { name: "Ada", tier: 2 } }
	const value = { tier: 2, name: "Ada" }
	for (const [op, expected, operand] of [
		["eq", true, value], ["neq", false, value],
		["in", true, [value]], ["not_in", false, [value]],
	] as const) {
		assert.equal(matchesRoutingRule({
			conditions: [{ field: "subscriber.attributes.profile", op, value: operand }],
			channels: ["EMAIL"],
		}, { attributes, preferences: {} }), expected)
	}
})
