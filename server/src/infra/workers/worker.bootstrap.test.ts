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
			waitUntilReady: async () => undefined,
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

test("worker readiness waits for BullMQ and module startup hooks", async () => {
	const events: string[] = []
	const loader: WorkerModuleLoader = async () => ({
		worker: {
			waitUntilReady: async () => void events.push("bullmq-ready"),
			close: async () => void events.push("closed"),
		},
		startWorkerModule: async () => void events.push("module-ready"),
	})

	await startWorkers([loader])
	assert.equal(workerState.status, "ready")
	assert.deepEqual(events, ["bullmq-ready", "module-ready"])
	await stopWorkers()
})

test("worker startup fails when a module exports no worker", async () => {
	await assert.rejects(
		() => startWorkers([async () => ({})]),
		/Worker module did not export a BullMQ worker/,
	)
	assert.equal(workerState.status, "failed")
	await stopWorkers()
})
