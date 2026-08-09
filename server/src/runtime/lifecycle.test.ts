import assert from "node:assert/strict"
import test from "node:test"
import { beginDrain, lifecycleState, markStarted } from "./lifecycle.ts"

test("draining is visible before resource shutdown", () => {
	markStarted()
	assert.deepEqual(lifecycleState, { started: true, draining: false })
	beginDrain()
	assert.deepEqual(lifecycleState, { started: true, draining: true })
})
