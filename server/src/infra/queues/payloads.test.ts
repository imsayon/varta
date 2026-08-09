import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { SendEmailJobSchema, SendInAppJobSchema, SendWebhookJobSchema } from "./payloads.ts"

describe("Queue Payload Validation Schemas", () => {
	it("validates correct SendEmailJobSchema payload", () => {
		const validPayload = {
			version: 1,
			notificationId: "notif_123",
			deliveryId: "del_123",
			workspaceId: "ws_123",
			requestId: "req_123",
			correlationId: "corr_123",
			traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
		}

		const parsed = SendEmailJobSchema.parse(validPayload)
		assert.equal(parsed.notificationId, "notif_123")
		assert.equal(parsed.requestId, "req_123")
		assert.equal(parsed.correlationId, "corr_123")
		assert.equal(parsed.version, 1)
	})

	it("rejects unversioned delivery jobs", () => {
		const invalidPayload = {
			notificationId: "notif_123",
			deliveryId: "del_123",
			workspaceId: "ws_123",
		}

		assert.throws(() => SendEmailJobSchema.parse(invalidPayload))
	})

	it("validates correct SendInAppJobSchema payload", () => {
		const payload = {
			version: 1,
			notificationId: "notif_123",
			deliveryId: "del_123",
			workspaceId: "ws_123",
		}

		const parsed = SendInAppJobSchema.parse(payload)
		assert.equal(parsed.deliveryId, "del_123")
	})

	it("validates correct SendWebhookJobSchema payload", () => {
		const payload = {
			version: 1,
			notificationId: "notif_123",
			deliveryId: "del_123",
			workspaceId: "ws_123",
		}

		const parsed = SendWebhookJobSchema.parse(payload)
		assert.equal(parsed.workspaceId, "ws_123")
	})
})
