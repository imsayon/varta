import { describe, it } from "node:test"
import assert from "node:assert/strict"

function evaluateCondition(condition: { field: string; operator: string; value: unknown }, payload: Record<string, unknown>): boolean {
	const val = payload[condition.field]
	switch (condition.operator) {
		case "EQUALS":
			return val === condition.value
		case "CONTAINS":
			return typeof val === "string" && val.includes(String(condition.value))
		case "GREATER_THAN":
			return typeof val === "number" && val > Number(condition.value)
		default:
			return false
	}
}

describe("Routing Rule Evaluator", () => {
	it("evaluates EQUALS condition correctly", () => {
		const result = evaluateCondition({ field: "plan", operator: "EQUALS", value: "pro" }, { plan: "pro" })
		assert.equal(result, true)
	})

	it("evaluates CONTAINS condition correctly", () => {
		const result = evaluateCondition({ field: "email", operator: "CONTAINS", value: "@varta.dev" }, { email: "user@varta.dev" })
		assert.equal(result, true)
	})

	it("evaluates GREATER_THAN condition correctly", () => {
		const result = evaluateCondition({ field: "amount", operator: "GREATER_THAN", value: 100 }, { amount: 250 })
		assert.equal(result, true)
	})
})
