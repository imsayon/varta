import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import {
	createWebhookSignature,
	isPrivateAddress,
	verifyResendWebhookSignature,
	verifyWebhookSignature,
} from "./webhook.util.ts"

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

	it("verifies Resend signatures over the exact event id, timestamp, and bytes", () => {
		const key = Buffer.from("resend-webhook-test-key")
		const secret = `whsec_${key.toString("base64")}`
		const eventId = "msg_test"
		const timestamp = "1725000000"
		const body = '{"type":"email.delivered"}'
		const signature = createHmac("sha256", key)
			.update(`${eventId}.${timestamp}.${body}`)
			.digest("base64")
		assert.equal(
			verifyResendWebhookSignature(
				eventId,
				timestamp,
				body,
				secret,
				`v1,${signature}`,
			),
			true,
		)
		assert.equal(
			verifyResendWebhookSignature(eventId, timestamp, `${body} `, secret, `v1,${signature}`),
			false,
		)
	})

	it("rejects non-public IPv4 and IPv6 destinations", () => {
		for (const address of [
			"127.0.0.1",
			"169.254.169.254",
			"10.0.0.1",
			"192.168.1.1",
			"224.0.0.1",
			"::1",
			"fd00::1",
			"fe80::1",
			"::ffff:127.0.0.1",
		]) {
			assert.equal(isPrivateAddress(address), true, address)
		}
		assert.equal(isPrivateAddress("8.8.8.8"), false)
	})
})
