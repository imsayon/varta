import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createWebhookSignature, verifyWebhookSignature } from "./webhook.util.ts"

describe("webhook signatures", () => {
	it("verifies the same timestamp and raw body", () => {
		const timestamp = 1_725_000_000
		const body = JSON.stringify({ specVersion: "1.0", deliveryId: "delivery_1" })
		const secret = "a-secure-signing-secret"
		const signature = createWebhookSignature(timestamp, body, secret)

		assert.equal(verifyWebhookSignature(timestamp, body, secret, signature), true)
		assert.equal(verifyWebhookSignature(timestamp, `${body} `, secret, signature), false)
		assert.equal(verifyWebhookSignature(timestamp + 1, body, secret, signature), false)
	})
})
