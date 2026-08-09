import assert from "node:assert/strict"
import test from "node:test"
import crypto from "node:crypto"
import { razorpayClient } from "./razorpay.client.ts"
import { billingService } from "./billing.service.ts"
import { BILLING_CATALOG } from "./billing.constants.ts"
import { deriveEntitlements, canTransitionSubscription } from "./billing-state.ts"

// --- Phase F3/F4 Razorpay Client & Webhook Signature Unit Tests ---

test("Razorpay Client: HMAC webhook signature verification", () => {
	const rawPayload = JSON.stringify({ event: "subscription.charged", entity: { id: "sub_123" } })
	const secret = "whsec_test_secret_key_12345"

	const validSignature = crypto
		.createHmac("sha256", secret)
		.update(rawPayload)
		.digest("hex")

	// Valid signature passes
	assert.equal(razorpayClient.verifyWebhookSignature(rawPayload, validSignature, secret), true)

	// Tampered payload fails
	assert.equal(razorpayClient.verifyWebhookSignature(rawPayload + "tampered", validSignature, secret), false)

	// Invalid signature fails
	assert.equal(razorpayClient.verifyWebhookSignature(rawPayload, "invalid_sig", secret), false)

	// Missing inputs fail
	assert.equal(razorpayClient.verifyWebhookSignature("", validSignature, secret), false)
})

test("Razorpay Client: customer and subscription creation returns test IDs in test mode", async () => {
	const customerId = await razorpayClient.createCustomer({
		name: "Test Customer",
		email: "billing-owner@example.test",
	})
	assert.ok(customerId.startsWith("cust_test_"), "Customer ID created in test mode")

	const sub = await razorpayClient.createSubscription({
		planId: "plan_plus_test",
	})
	assert.ok(sub.subscriptionId.startsWith("sub_test_"), "Subscription ID created in test mode")
	assert.equal(sub.status, "created")
})

// --- Phase F5/F6 Subscription State Machine & Quota Reservation Tests ---

test("Billing Entitlement: Free plan active status defaults to 10,000 monthly runs", () => {
	const ent = deriveEntitlements("free", "ACTIVE")
	assert.equal(ent.canAcceptNotifications, true)
	assert.equal(ent.canAccessAi, false) // AI disabled on Free
	assert.equal(ent.limits.maxNotificationRunsPerMonth, 10_000)
	assert.equal(ent.limits.maxRps, 5)
})

test("Billing Entitlement: Plus plan active status enables AI and 250,000 runs", () => {
	const ent = deriveEntitlements("plus", "ACTIVE")
	assert.equal(ent.canAcceptNotifications, true)
	assert.equal(ent.canAccessAi, true)
	assert.equal(ent.limits.maxNotificationRunsPerMonth, 250_000)
	assert.equal(ent.limits.maxRps, 25)
})

test("Billing State Machine: Monotonic transitions safeguard state changes", () => {
	// Legal transitions
	assert.equal(canTransitionSubscription("PENDING", "ACTIVE"), true)
	assert.equal(canTransitionSubscription("ACTIVE", "GRACE"), true)
	assert.equal(canTransitionSubscription("GRACE", "ACTIVE"), true) // Recovery
	assert.equal(canTransitionSubscription("GRACE", "EXPIRED"), true) // Grace lapse
	assert.equal(canTransitionSubscription("ACTIVE", "CANCELLED"), true)

	// Illegal transitions fail closed
	assert.equal(canTransitionSubscription("PENDING", "GRACE"), false)
	assert.equal(canTransitionSubscription("EXPIRED", "GRACE"), false)
	assert.equal(canTransitionSubscription("CANCELLED", "GRACE"), false)
})
