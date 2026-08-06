import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
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
	]
	for (const relativePath of routeFiles) {
		const source = readFileSync(resolve(import.meta.dirname, "../../..", relativePath), "utf8")
		const mounts = source.match(/(?:app|router)\.(?:get|post|put|patch|delete)\s*\(/g) ?? []
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
