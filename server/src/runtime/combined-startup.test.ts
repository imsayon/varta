import assert from "node:assert/strict"
import { test } from "node:test"
import { startCombinedBackend } from "./combined-startup.ts"

test("combined startup exposes HTTP only after workers and WebSocket setup succeed", async () => {
	const events: string[] = []

	await startCombinedBackend({
		connectRedis: async () => {
			events.push("redis")
		},
		startWorkers: async () => {
			events.push("workers")
		},
		startWebSocketServer: async () => {
			events.push("websocket")
		},
		listen: async () => {
			events.push("listen")
		},
		stopWorkers: async () => {
			events.push("stop")
		},
	})

	assert.deepEqual(events, ["redis", "workers", "websocket", "listen"])
})

test("combined startup stops workers when the HTTP listener fails", async () => {
	const events: string[] = []

	await assert.rejects(
		() =>
			startCombinedBackend({
				connectRedis: async () => {
					events.push("redis")
				},
				startWorkers: async () => {
					events.push("workers")
				},
				startWebSocketServer: async () => {
					events.push("websocket")
				},
				listen: async () => {
					events.push("listen")
					throw new Error("port unavailable")
				},
				stopWorkers: async () => {
					events.push("stop")
				},
			}),
		/port unavailable/,
	)

	assert.deepEqual(events, ["redis", "workers", "websocket", "listen", "stop"])
})
