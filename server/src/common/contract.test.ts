import { describe, it } from "node:test"
import assert from "node:assert/strict"
import express from "express"
import { requestIdMiddleware } from "./middleware/request-id.middleware.ts"
import { sendSuccess, sendPaginated } from "./utils/response.ts"
import { errorHandler } from "./middleware/error.middleware.ts"
import { ValidationError, NotFoundError } from "./errors/app-error.ts"
import { parsePaginationQuery, encodeCursor, decodeCursor } from "./utils/pagination.ts"
import { openApiSpec } from "./openapi.ts"

describe("C1 API Contract & Envelope Suite", () => {
	it("attaches x-request-id to request and response", async () => {
		const app = express()
		app.use(requestIdMiddleware)
		app.get("/test", (req, res) => {
			sendSuccess(req, res, { message: "ok" })
		})

		const req = { headers: {}, method: "GET", url: "/test" } as any
		let resHeaders: Record<string, string> = {}
		let resStatusCode = 200
		let resBody: any = null

		const res = {
			setHeader(key: string, val: string) {
				resHeaders[key] = val
			},
			getHeader(key: string) {
				return resHeaders[key]
			},
			status(code: number) {
				resStatusCode = code
				return this
			},
			json(body: any) {
				resBody = body
				return this
			},
		} as any

		requestIdMiddleware(req, res, () => {
			sendSuccess(req, res, { message: "ok" })
		})

		assert.equal(resStatusCode, 200)
		assert.equal(resBody.success, true)
		assert.equal(resBody.data.message, "ok")
		assert.ok(typeof resBody.meta.requestId === "string")
		assert.ok(resBody.meta.requestId.startsWith("req_"))
		assert.equal(resHeaders["x-request-id"], resBody.meta.requestId)
	})

	it("formats validation errors and app errors with standard envelope", async () => {
		const req = { requestId: "req_test_123" } as any
		let statusCode = 0
		let jsonBody: any = null

		const res = {
			headersSent: false,
			status(code: number) {
				statusCode = code
				return this
			},
			json(body: any) {
				jsonBody = body
				return this
			},
			getHeader() { return undefined },
		} as any

		const validationErr = new ValidationError("Invalid email format", {
			email: ["Must be a valid email"],
		})

		errorHandler(validationErr, req, res, () => {})

		assert.equal(statusCode, 400)
		assert.equal(jsonBody.success, false)
		assert.equal(jsonBody.error.code, "VALIDATION_ERROR")
		assert.equal(jsonBody.error.message, "Invalid email format")
		assert.deepEqual(jsonBody.error.details, { email: ["Must be a valid email"] })
		assert.equal(jsonBody.meta.requestId, "req_test_123")
	})

	it("encodes and decodes opaque cursor strings safely", () => {
		const payload = { id: "sub_123", createdAt: "2026-08-06T12:00:00.000Z" }
		const encoded = encodeCursor(payload)
		assert.ok(typeof encoded === "string")

		const decoded = decodeCursor(encoded)
		assert.deepEqual(decoded, payload)

		assert.equal(decodeCursor("invalid_base64_string!!!"), null)
		assert.equal(decodeCursor(undefined), null)
	})

	it("parses pagination params with limits bounded between 1 and 100", () => {
		const defaultParams = parsePaginationQuery({})
		assert.equal(defaultParams.limit, 20)
		assert.equal(defaultParams.cursor, undefined)

		const customParams = parsePaginationQuery({ limit: "500", search: "  test " })
		assert.equal(customParams.limit, 100)
		assert.equal(customParams.search, "test")
	})

	it("serves a valid OpenAPI 3.0 specification object", () => {
		assert.equal(openApiSpec.openapi, "3.0.3")
		assert.equal(openApiSpec.info.title, "Varta API")
		assert.ok(openApiSpec.paths["/auth/login"])
		assert.ok(openApiSpec.components.schemas.ApiSuccessEnvelope)
	})
})
