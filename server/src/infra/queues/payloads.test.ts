import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { SendEmailJobSchema, SendInAppJobSchema, SendWebhookJobSchema } from "./payloads.ts"

describe("Queue Payload Validation Schemas", () => {
	it("validates correct SendEmailJobSchema payload", () => {
		const validPayload = {
			notificationId: "notif_123",
			deliveryId: "del_123",
			workspaceId: "ws_123",
			subscriberEmail: "user@example.com",
			renderedContent: {
				subject: "Welcome",
				html: "<p>Hello</p>",
			},
			providerConfig: {
				providerName: "resend",
				apiKey: "re_1234567890",
				fromAddress: "alerts@example.com",
			},
		}

		const parsed = SendEmailJobSchema.parse(validPayload)
		assert.equal(parsed.notificationId, "notif_123")
		assert.equal(parsed.subscriberEmail, "user@example.com")
	})

	it("throws on invalid subscriberEmail in SendEmailJobSchema", () => {
		const invalidPayload = {
			notificationId: "notif_123",
			deliveryId: "del_123",
			workspaceId: "ws_123",
			subscriberEmail: "not-an-email",
			renderedContent: {
				subject: "Welcome",
				html: "<p>Hello</p>",
			},
			providerConfig: {
				providerName: "resend",
				apiKey: "re_1234567890",
				fromAddress: "alerts@example.com",
			},
		}

		assert.throws(() => SendEmailJobSchema.parse(invalidPayload))
	})

	it("validates correct SendInAppJobSchema payload", () => {
		const payload = {
			notificationId: "notif_123",
			deliveryId: "del_123",
			workspaceId: "ws_123",
			subscriberId: "sub_123",
			content: { title: "New notification", body: "Check dashboard" },
		}

		const parsed = SendInAppJobSchema.parse(payload)
		assert.equal(parsed.subscriberId, "sub_123")
	})

	it("validates correct SendWebhookJobSchema payload", () => {
		const payload = {
			notificationId: "notif_123",
			deliveryId: "del_123",
			workspaceId: "ws_123",
			url: "https://example.com/webhook",
			eventType: "order.created",
			payload: { orderId: 101 },
			signingSecret: "secret_123",
		}

		const parsed = SendWebhookJobSchema.parse(payload)
		assert.equal(parsed.eventType, "order.created")
	})
})
