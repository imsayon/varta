import assert from "node:assert/strict"
import { test } from "node:test"
import {
	startWorkers,
	stopWorkers,
	workerState,
	type WorkerModuleLoader,
} from "./worker.bootstrap.ts"

function loaderWithClose(
	closed: string[],
	name: string,
): WorkerModuleLoader {
	return async () => ({
		worker: {
			close: async () => {
				closed.push(name)
			},
		},
	})
}

test("worker startup cleans up already registered workers on partial failure", async () => {
	const closed: string[] = []
	const failingLoader: WorkerModuleLoader = async () => {
		throw new Error("worker module failed")
	}

	await assert.rejects(
		() => startWorkers([loaderWithClose(closed, "first"), failingLoader]),
		/worker module failed/,
	)
	assert.equal(workerState.status, "failed")
	assert.deepEqual(closed, ["first"])

	await stopWorkers()
	assert.equal(workerState.status, "stopped")
})

test("worker readiness is published only after every worker module loads", async () => {
	const closed: string[] = []

	await startWorkers([
		loaderWithClose(closed, "first"),
		loaderWithClose(closed, "second"),
	])
	assert.equal(workerState.status, "ready")

	await stopWorkers()
	assert.equal(workerState.status, "stopped")
	assert.deepEqual(closed, ["first", "second"])
})
