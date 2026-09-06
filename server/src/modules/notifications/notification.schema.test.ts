import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { triggerNotificationSchema } from "./notification.schema.ts"

const request = {
	templateId: "template-1",
	subscriberExternalId: "subscriber-1",
	payload: {},
}

describe("triggerNotificationSchema", () => {
	it("allows scheduled delivery but rejects unfinished smart timing", () => {
		assert.equal(
			triggerNotificationSchema.safeParse({
				...request,
				options: { scheduledAt: "2026-08-30T12:00:00.000Z" },
			}).success,
			true,
		)
		assert.equal(
			triggerNotificationSchema.safeParse({
				...request,
				options: { smartTiming: true },
			}).success,
			false,
		)
	})
})
