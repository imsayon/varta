import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createSubscriberSchema, updateSubscriberSchema } from "./subscriber.schema.ts"

describe("C5 Subscriber Journey Schema Unit Suite", () => {
	it("validates subscriber creation inputs with externalId and optional fields", () => {
		const valid = createSubscriberSchema.parse({
			externalId: "usr_1001",
			email: "alex@example.test",
			name: "Alex Vance",
			timezone: "UTC",
			locale: "en-US",
			attributes: { plan: "pro" },
			preferences: { email: true, inapp: true },
		})

		assert.equal(valid.externalId, "usr_1001")
		assert.equal(valid.email, "alex@example.test")
		assert.equal(valid.timezone, "UTC")
	})

	it("rejects invalid email formats or empty external IDs", () => {
		assert.throws(() => createSubscriberSchema.parse({ externalId: "" }))
		assert.throws(() => createSubscriberSchema.parse({ externalId: "usr_1", email: "invalid-email" }))
	})

	it("validates partial subscriber updates", () => {
		const updated = updateSubscriberSchema.parse({
			name: "Alex Vance Updated",
			preferences: { email: false },
		})

		assert.equal(updated.name, "Alex Vance Updated")
	})
})
