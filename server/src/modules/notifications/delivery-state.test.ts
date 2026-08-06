import assert from "node:assert/strict"
import test from "node:test"
import { canTransitionDelivery } from "./delivery-state.ts"

test("delivery state transitions are explicit and terminal states stay terminal", () => {
	assert.equal(canTransitionDelivery("PENDING", "RUNNING"), true)
	assert.equal(canTransitionDelivery("RUNNING", "SUCCESS"), true)
	assert.equal(canTransitionDelivery("RUNNING", "FAILED"), true)
	assert.equal(canTransitionDelivery("FAILED", "RUNNING"), true)
	assert.equal(canTransitionDelivery("SUCCESS", "RUNNING"), false)
	assert.equal(canTransitionDelivery("DLQ", "RUNNING"), false)
	assert.equal(canTransitionDelivery("PENDING", "SUCCESS"), false)
})
