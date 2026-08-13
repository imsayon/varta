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
