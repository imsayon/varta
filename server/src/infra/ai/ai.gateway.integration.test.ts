import assert from "node:assert/strict"
import test from "node:test"

const enabled = process.env.RUN_AI_GATEWAY_DATABASE_TESTS === "true"
let cleanup: (() => Promise<void>) | undefined

test.after(async () => {
	await cleanup?.()
})

test("AI gateway integrates policy, Redis, Gemini, schema validation, and durable metering", { skip: !enabled }, async () => {
	const [{ disconnectDatabase, prisma }, { connectRedis, disconnectRedis }, { createOwnedTestWorkspace }, { routingRuleCompiler }] = await Promise.all([
		import("@/infra/database/prisma.ts"),
		import("@/infra/redis/redis.connection.ts"),
		import("@/testing/billing-test-fixture.ts"),
		import("@/modules/routing-rules/routing-rule.compiler.ts"),
	])
	await connectRedis()
	cleanup = async () => {
		await disconnectDatabase()
		await disconnectRedis()
	}
	const fixture = await createOwnedTestWorkspace("AI gateway integration")
	try {
		const result = await routingRuleCompiler.compile(
			fixture.workspace.id,
			"Send email to subscribers whose plan attribute equals plus, otherwise send an in-app notification.",
		)
		assert.equal(result.ast.logic, "AND")
		assert.deepEqual(result.ast.conditions, [{
			field: "subscriber.attributes.plan",
			op: "eq",
			value: "plus",
		}])
		assert.deepEqual(result.ast.channels, ["EMAIL"])
		assert.deepEqual(result.ast.fallback?.channels, ["IN_APP"])

		const usage = await prisma.aiUsage.findFirstOrThrow({
			where: { workspaceId: fixture.workspace.id, status: "success" },
		})
		assert.equal(usage.provider, "gemini")
		assert.equal(usage.model, "gemini-3.6-flash")
		assert.equal(usage.promptVersion, "routing_compiler_v1")
		assert.ok(usage.requestId)
		assert.ok((usage.inputTokens ?? 0) > 0)
		assert.ok((usage.outputTokens ?? 0) > 0)

		const reservation = await prisma.usageLedger.findUniqueOrThrow({
			where: { operationId: `ai:${fixture.workspace.id}:${usage.requestId}` },
		})
		assert.equal(reservation.kind, "AI_RESERVATION")
		assert.equal(reservation.deltaUnits, 1)
	} finally {
		await fixture.cleanup()
	}
})
