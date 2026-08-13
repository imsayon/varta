import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"
import {
	closeHttpServer,
	listen,
	shutdownResources,
} from "./shutdown.ts"

test("listen resolves only after the HTTP server is accepting connections", async () => {
	const server = createServer((_request, response) => response.end("ok"))

	await listen(server, 0)
	assert.equal(server.listening, true)
	await closeHttpServer(server)
	assert.equal(server.listening, false)
})

test("shutdown records cleanup failures without skipping other resources", async () => {
	const completed: string[] = []
	const result = await shutdownResources(
		[
			[
				async () => {
					completed.push("first")
					throw new Error("first cleanup failed")
				},
				async () => {
					completed.push("second")
				},
			],
		],
		100,
	)

	assert.deepEqual(completed, ["first", "second"])
	assert.equal(result.timedOut, false)
	assert.equal(result.failures.length, 1)
})

test("shutdown completes dependency phases in order", async () => {
	const completed: string[] = []
	const result = await shutdownResources(
		[
			[async () => void completed.push("intake")],
			[async () => void completed.push("workers")],
			[async () => void completed.push("dependencies")],
		],
		100,
	)

	assert.deepEqual(completed, ["intake", "workers", "dependencies"])
	assert.equal(result.timedOut, false)
})

test("shutdown reports a bounded timeout for a stuck resource", async () => {
	const result = await shutdownResources(
		[
			[() => new Promise<void>(() => undefined)],
		],
		5,
	)

	assert.equal(result.timedOut, true)
})
