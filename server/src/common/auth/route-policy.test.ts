import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import type { NextFunction, Request, Response } from "express"
import { EmailNotVerifiedError } from "@/common/errors/app-error.ts"
import { authorize, getRoutePolicy, ROUTE_POLICY_MATRIX } from "./route-policy.ts"
import { isPrincipal } from "./principal.ts"

test("every declared mounted route has a named, unique policy", () => {
	const ids = ROUTE_POLICY_MATRIX.map((policy) => policy.id)
	assert.equal(new Set(ids).size, ids.length)
	for (const policy of ROUTE_POLICY_MATRIX) {
		assert.equal(getRoutePolicy(policy.id).id, policy.id)
		assert.match(policy.method, /^(GET|POST|PATCH|PUT|DELETE)$/)
		assert.ok(policy.path.startsWith("/"))
		if (policy.public) assert.equal(policy.principalKinds, undefined)
		else assert.ok(policy.principalKinds && policy.principalKinds.length > 0)
	}
})

test("unclassified route policies fail closed at declaration time", () => {
	assert.throws(() => authorize("route.not.declared"), /Missing route authorization policy/)
})

test("every mounted Express leaf route uses the named policy middleware", () => {
	const routeFiles = [
		"src/app.ts",
		"src/modules/health/health.routes.ts",
		"src/modules/auth/auth.routes.ts",
		"src/modules/workspaces/workspace.routes.ts",
		"src/modules/subscribers/subscriber.routes.ts",
		"src/modules/templates/template.routes.ts",
		"src/modules/api-keys/api-key.routes.ts",
		"src/modules/notifications/notification.routes.ts",
		"src/modules/routing-rules/routing-rule.routes.ts",
		"src/modules/analytics/analytics.routes.ts",
		"src/modules/providers/provider.routes.ts",
		"src/modules/webhooks/webhook-inbound.routes.ts",
		"src/modules/billing/billing.routes.ts",
	]
	for (const relativePath of routeFiles) {
		const source = readFileSync(resolve(import.meta.dirname, "../../..", relativePath), "utf8")
		const mounts = source.match(/(?:app|router|[A-Za-z]\w*Router)\.(?:get|post|put|patch|delete)\s*\(/g) ?? []
		const policies = source.match(/authorize\("[^"]+"\)/g) ?? []
		assert.equal(policies.length, mounts.length, `${relativePath} has an unclassified leaf route`)
	}
})

test("invalid principal kinds are rejected by the runtime type guard", () => {
	assert.equal(
		isPrincipal({
			kind: "browser-jwt",
			actorId: "user-1",
			workspaceId: "workspace-1",
			scopes: [],
			verification: "verified",
		}),
		false,
	)
	assert.equal(
		isPrincipal({
			kind: "browser_jwt",
			actorId: "user-1",
			workspaceId: "workspace-1",
			sessionId: "session-1",
			role: "INVALID",
			scopes: [],
			verification: "verified",
		}),
		false,
	)
})

test("unverified browser principals cannot use product routes", () => {
	let failure: unknown
	const middleware = authorize("workspace.list")
	const request = {
		params: {},
		capability: {
			principal: {
				kind: "browser_jwt",
				actorId: "user-1",
				workspaceId: "workspace-1",
				sessionId: "session-1",
				role: "OWNER",
				scopes: [],
				verification: "unverified",
			},
			workspace: {
				workspaceId: "workspace-1",
				role: "OWNER",
				scopes: [],
				verification: "unverified",
				actorId: "user-1",
				principalKind: "browser_jwt",
			},
		},
	} as unknown as Request
	middleware(
		request,
		{} as Response,
		((error?: unknown) => {
			failure = error
		}) as NextFunction,
	)
	assert.ok(failure instanceof EmailNotVerifiedError)
})
