import assert from "node:assert/strict"
import test from "node:test"
import { validateSameOriginOrCsrf } from "./cookies.ts"

test("cookie-authenticated requests require an exact trusted origin", () => {
	assert.equal(
		validateSameOriginOrCsrf({
			headers: {
				cookie: "refreshToken=token",
				origin: "http://localhost:3000",
			},
		}),
		true,
	)
	assert.equal(
		validateSameOriginOrCsrf({
			headers: {
				cookie: "refreshToken=token",
				origin: "http://localhost:3000.evil.test",
			},
		}),
		false,
	)
	assert.equal(
		validateSameOriginOrCsrf({ headers: { cookie: "refreshToken=token" } }),
		false,
	)
})

test("non-cookie API clients do not need a browser origin", () => {
	assert.equal(validateSameOriginOrCsrf({ headers: {} }), true)
})
