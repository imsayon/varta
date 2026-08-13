import { routingRuleAstSchema, type RoutingRuleAst } from "./routing-rule.schema.ts"

type RoutingContext = {
	attributes: unknown
	preferences: unknown
}

function readPath(value: unknown, path: string): unknown {
	const segments = path.split(".")
	if (segments[0] === "subscriber") segments.shift()
	if (segments[0] === "attributes" || segments[0] === "preferences") segments.shift()

	let current = value
	for (const segment of segments) {
		if (!current || typeof current !== "object") return undefined
		current = (current as Record<string, unknown>)[segment]
	}
	return current
}

function deepEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right)
}

function evaluateCondition(
	condition: RoutingRuleAst["conditions"][number],
	context: RoutingContext,
): boolean {
	const source = condition.field.startsWith("subscriber.preferences.")
		? context.preferences
		: context.attributes
	const actual = readPath(source, condition.field)

	switch (condition.op) {
		case "eq":
			return deepEqual(actual, condition.value)
		case "neq":
			return !deepEqual(actual, condition.value)
		case "gt":
			return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value
		case "lt":
			return typeof actual === "number" && typeof condition.value === "number" && actual < condition.value
		case "gte":
			return typeof actual === "number" && typeof condition.value === "number" && actual >= condition.value
		case "lte":
			return typeof actual === "number" && typeof condition.value === "number" && actual <= condition.value
		case "in":
			return Array.isArray(condition.value) && condition.value.some((value) => deepEqual(value, actual))
		case "not_in":
			return Array.isArray(condition.value) && !condition.value.some((value) => deepEqual(value, actual))
		case "exists":
			return actual !== undefined && actual !== null
		case "contains":
			return typeof actual === "string" && typeof condition.value === "string"
				? actual.includes(condition.value)
				: Array.isArray(actual) && actual.some((value) => deepEqual(value, condition.value))
	}
}

export function matchesRoutingRule(
	ruleAst: unknown,
	context: RoutingContext,
): boolean {
	const ast = routingRuleAstSchema.parse(ruleAst)
	if (ast.conditions.length === 0) return true
	const results = ast.conditions.map((condition) => evaluateCondition(condition, context))
	return ast.logic === "OR" ? results.some(Boolean) : results.every(Boolean)
}
