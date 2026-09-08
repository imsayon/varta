import { test } from "node:test"
import assert from "node:assert/strict"
import type { Request, Response } from "express"
import { authorize } from "./route-policy.ts"
import { prisma } from "@/infra/database/prisma.ts"
import { workspaceContextFor, type BrowserJwtPrincipal } from "./principal.ts"

test("workspace selection checks target membership and target role without widening API keys", async (t) => {
	const principal: BrowserJwtPrincipal = {
		kind: "browser_jwt", actorId: "user", sessionId: "session",
		workspaceId: "original", role: "OWNER", scopes: [], verification: "verified",
	}
	const makeRequest = () => ({
		params: { workspaceId: "selected" },
		capability: { principal, workspace: workspaceContextFor(principal, "OWNER") },
	}) as unknown as Request
	let membership: { role: "ADMIN" | "MEMBER" } | null = { role: "ADMIN" }
	const original = prisma.workspaceMember.findUnique
	t.after(() => { prisma.workspaceMember.findUnique = original })
	const lookup = t.mock.fn(async (args: unknown) => {
		assert.deepEqual(args, { where: { userId_workspaceId: { userId: "user", workspaceId: "selected" } }, select: { role: true } })
		return membership
	})
	prisma.workspaceMember.findUnique = lookup as unknown as typeof original
	async function check(req: Request, policy = "template.create") {
		let error: unknown
		await authorize(policy)(req, {} as Response, (err?: unknown) => { error = err })
		return error
	}
	const allowed = makeRequest()
	assert.equal(await check(allowed), undefined)
	assert.equal(allowed.capability?.workspace?.workspaceId, "selected")
	assert.equal(allowed.capability?.workspace?.role, "ADMIN")
	membership = { role: "MEMBER" }
	assert.match(String(await check(makeRequest(), "routing.create")), /Insufficient role/)
	membership = null
	assert.match(String(await check(makeRequest())), /Resource not found/)
	const apiKey = makeRequest()
	apiKey.capability!.principal = { kind: "api_key", actorId: "key", keyId: "key", workspaceId: "original", scopes: ["*"], verification: "not_applicable" }
	const before = lookup.mock.callCount()
	let error: unknown
	await authorize("subscriber.create")(apiKey, {} as Response, (err?: unknown) => { error = err })
	assert.match(String(error), /Resource not found/)
	assert.equal(lookup.mock.callCount(), before)
})
