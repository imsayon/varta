import assert from "node:assert/strict"
import { once } from "node:events"
import test from "node:test"
import express, { type ErrorRequestHandler } from "express"
import { z } from "zod"
import { validate } from "./validate.middleware.ts"

test("validation preserves parsed request values with Express 5", async (t) => {
	const app = express()
	app.use(express.json())
	const schema = z.object({ count: z.coerce.number().int().min(1) })
	app.get("/query", validate(schema, "query"), (req, res) => res.json(req.query))
	app.post("/body", validate(schema), (req, res) => res.json(req.body))
	app.get("/params/:count", validate(schema, "params"), (req, res) => res.json(req.params))
	const errors: ErrorRequestHandler = (error, _req, res, _next) => {
		res.status(500).json({ message: String(error) })
	}
	app.use(errors)
	const server = app.listen(0, "127.0.0.1")
	await once(server, "listening")
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	const origin = `http://127.0.0.1:${address.port}`
	try {
		await t.test("invalid query is rejected before the handler", async () => {
			const response = await fetch(`${origin}/query?count=0`)
			assert.equal(response.status, 400)
			assert.equal((await response.json() as { error: { code: string } }).error.code, "VALIDATION_ERROR")
		})
		await t.test("valid query reaches the handler with coercion and unknown keys stripped", async () => {
			const response = await fetch(`${origin}/query?count=7&ignored=value`)
			assert.equal(response.status, 200)
			assert.deepEqual(await response.json(), { count: 7 })
		})
		await t.test("body parsing still returns validated output and rejects invalid input", async () => {
			const post = (body: unknown) => fetch(`${origin}/body`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
			const valid = await post({ count: "3", ignored: "value" })
			assert.equal(valid.status, 200)
			assert.deepEqual(await valid.json(), { count: 3 })
			const invalid = await post({ count: 0 })
			assert.equal(invalid.status, 400)
			await invalid.text()
		})
		await t.test("params parsing still returns validated output", async () => {
			const response = await fetch(`${origin}/params/4`)
			assert.equal(response.status, 200)
			assert.deepEqual(await response.json(), { count: 4 })
		})
	} finally {
		server.closeAllConnections()
		await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
	}
})
