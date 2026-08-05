import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { requireApiKeyScope } from "./api-key.middleware.ts"

describe("API Key Scope Middleware", () => {
	it("allows request when required scope is present", () => {
		const middleware = requireApiKeyScope("notifications:write")
		const req: any = {
			apiKey: {
				id: "key_1",
				workspaceId: "ws_1",
				permissions: ["notifications:write", "subscribers:read"],
			},
		}
		let nextCalled = false
		const res: any = {}

		middleware(req, res, () => {
			nextCalled = true
		})

		assert.equal(nextCalled, true)
	})

	it("denies request when required scope is missing", () => {
		const middleware = requireApiKeyScope("admin:all")
		const req: any = {
			apiKey: {
				id: "key_1",
				workspaceId: "ws_1",
				permissions: ["notifications:write"],
			},
		}
		let statusCode = 0
		let jsonBody: any = null

		const res: any = {
			status: (code: number) => {
				statusCode = code
				return {
					json: (data: any) => {
						jsonBody = data
					},
				}
			},
		}

		middleware(req, res, () => {})

		assert.equal(statusCode, 403)
		assert.equal(jsonBody?.code, "INSUFFICIENT_PERMISSIONS")
	})

	it("allows request when wildcard * scope is present", () => {
		const middleware = requireApiKeyScope("admin:all")
		const req: any = {
			apiKey: {
				id: "key_1",
				workspaceId: "ws_1",
				permissions: ["*"],
			},
		}
		let nextCalled = false
		const res: any = {}

		middleware(req, res, () => {
			nextCalled = true
		})

		assert.equal(nextCalled, true)
	})
})
