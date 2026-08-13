import assert from "node:assert/strict"
import test from "node:test"
import type { NextFunction, Request, Response } from "express"

const enabled = process.env.RUN_BILLING_DATABASE_TESTS === "true"
let cleanup: (() => Promise<void>) | undefined

test.after(async () => {
	await cleanup?.()
})

test("workspace trigger limiter enforces the active Free plan's ten requests per second", { skip: !enabled }, async () => {
	const [{ disconnectDatabase }, { connectRedis, disconnectRedis }, { createOwnedTestWorkspace }, { rateLimitWorkspaceTrigger }] = await Promise.all([
		import("@/infra/database/prisma.ts"),
		import("@/infra/redis/redis.connection.ts"),
		import("@/testing/billing-test-fixture.ts"),
		import("./rate-limit.middleware.ts"),
	])
	await connectRedis()
	cleanup = async () => {
		await disconnectDatabase()
		await disconnectRedis()
	}
	const fixture = await createOwnedTestWorkspace("Billing rate limit")
	try {
		const errors: unknown[] = []
		const request = { params: { workspaceId: fixture.workspace.id } } as unknown as Request
		const response = {} as Response
		for (let attempt = 0; attempt < 11; attempt += 1) {
			await rateLimitWorkspaceTrigger(request, response, ((error?: unknown) => {
				if (error) errors.push(error)
			}) as NextFunction)
		}
		assert.equal(errors.length, 1)
		assert.match(errors[0] instanceof Error ? errors[0].message : "", /active plan/)
	} finally {
		await fixture.cleanup()
	}
})
